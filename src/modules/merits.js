(function registerMeritsModule(global) {
  'use strict';

  const SLINK = global.SLINK_EXTENSION;
  if (!SLINK) throw new Error('SLINK runtime must load before Merits.');

  const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, character => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[character]));
  const relativeTime = timestamp => {
    if (!Number(timestamp)) return 'not checked yet';
    const seconds = Math.max(0, Math.floor((Date.now() - Number(timestamp)) / 1000));
    if (seconds < 60) return `${seconds}s ago`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s ago`;
    return `${Math.floor(seconds / 3600)}h ${Math.floor(seconds % 3600 / 60)}m ago`;
  };
  const formatNumber = value => Math.max(0, Number(value) || 0).toLocaleString('en-US', { maximumFractionDigits:1 });

  function progressMarkup(progress) {
    if (!progress?.rows?.length) return '<div class="slink-merit-unavailable">No reliable live counter from Torn.</div>';
    const percent = Math.min(100, ...progress.rows.map(row => Math.floor(Number(row.current) / Number(row.target) * 100)));
    return `<div class="slink-merit-progress"><div><strong>${percent}%</strong><span>${progress.rows.map(row => `${formatNumber(row.current)} / ${formatNumber(row.target)} ${escapeHtml(row.label)}${row.current < row.target ? ` · ${formatNumber(row.target - row.current)} left` : ''}`).join('<br>')}</span></div><i><b style="width:${percent}%"></b></i></div>`;
  }

  function cardMarkup(goal, status, pinned = false) {
    const isPinned = status.settings?.pinned?.includes(goal.key);
    const later = goal.laterMilestones?.length
      ? `<small class="slink-merit-later">Later: ${goal.laterMilestones.slice(0, 5).map(row => `${escapeHtml(row.name)}${row.targets?.length ? ` ${row.targets.map(formatNumber).join(' / ')}` : ''}`).join(' · ')}</small>`
      : '';
    return `<article class="slink-merit-card ${pinned ? 'pinned' : ''}"><header><div><strong>${escapeHtml(goal.name)}</strong><small>${goal.kind === 'medal' ? 'Medal' : 'Honor'}${goal?.type?.title ? ` · ${escapeHtml(goal.type.title)}` : ''}</small></div><button type="button" data-merit-pin="${escapeHtml(goal.key)}">${isPinned ? 'Unpin' : 'Pin'}</button></header><p>${escapeHtml(goal.description || 'Torn did not provide a requirement.')}</p>${progressMarkup(goal.progress)}${later}</article>`;
  }

  SLINK.modules.register({
    id:'merits',
    title:'SLINK Merits',
    shortTitle:'Merits',
    group:'efficiency',
    groupTitle:'Efficiency',
    requiredScopes:[SLINK.core.merits.REQUIRED_SCOPE],
    defaultShowInTorn:true,
    matches:url => url.hostname === 'www.torn.com',
    async start(context) {
      const ui = context.ui;
      let stopped = false;
      let current = null;
      let apiTimer = null;
      let clockTimer = null;

      ui.setModuleStyles(`
        .slink-merit-summary{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:5px}.slink-merit-summary>div{padding:7px;border:1px solid var(--slink-border-soft);border-radius:7px;background:var(--slink-bg-control);text-align:center}.slink-merit-summary strong,.slink-merit-summary span{display:block}.slink-merit-summary span{color:var(--slink-muted);font-size:9px}
        .slink-merit-controls{display:grid;grid-template-columns:1fr 1fr;gap:6px}.slink-merit-controls label{display:grid;gap:3px;color:var(--slink-muted);font-size:9px}.slink-merit-controls select{min-width:0;padding:5px;border:1px solid var(--slink-border-soft);border-radius:5px;background:var(--slink-bg);color:var(--slink-text)}
        .slink-merit-section-title{display:flex;justify-content:space-between;gap:6px;color:var(--slink-muted);font-size:10px}.slink-merit-list{display:grid;gap:6px}.slink-merit-card{padding:7px;border:1px solid var(--slink-border-soft);border-radius:7px;background:var(--slink-bg-control)}.slink-merit-card.pinned{border-color:var(--slink-accent-alt);box-shadow:inset 3px 0 var(--slink-accent-alt)}.slink-merit-card header{display:flex;align-items:start;gap:6px}.slink-merit-card header>div{min-width:0;flex:1}.slink-merit-card header strong,.slink-merit-card header small{display:block}.slink-merit-card header small,.slink-merit-card p,.slink-merit-later,.slink-merit-unavailable{color:var(--slink-muted)}.slink-merit-card p{margin:5px 0}.slink-merit-card button{min-height:24px;padding:2px 7px;font-size:10px}.slink-merit-progress>div{display:flex;justify-content:space-between;gap:6px}.slink-merit-progress span{text-align:right;font-size:9px}.slink-merit-progress i{display:block;height:5px;margin-top:4px;overflow:hidden;border-radius:99px;background:var(--slink-bg)}.slink-merit-progress b{display:block;height:100%;background:var(--slink-ready)}.slink-merit-later{display:block;margin-top:5px;font-size:9px}.slink-merit-unavailable{font-size:9px}
      `);

      function setStatus() {
        if (!current) return;
        ui.setStatus(current.lastError || `Updated ${relativeTime(current.fetchedAt)} · automatic every ${current.settings?.refreshMinutes || 15} minutes`, current.lastError ? 'error' : current.fetchedAt ? 'ready' : 'normal');
      }

      function render(status) {
        current = status;
        setStatus();
        if (!status?.configured || !status?.permitted) {
          ui.getContentElement().innerHTML = `<div class="slink-merit-unavailable">${escapeHtml(status?.lastError || 'Enable Efficiency and save your Torn API key in the extension dashboard.')}</div>`;
          return;
        }
        const pinned = Array.isArray(status.pinned) ? status.pinned : [];
        const goals = Array.isArray(status.goals) ? status.goals : [];
        const unpinnedGoals = goals.filter(goal => !status.settings?.pinned?.includes(goal.key));
        ui.getContentElement().innerHTML = `<div class="slink-merit-summary"><div><strong>${status.completedCount || 0}</strong><span>earned</span></div><div><strong>${goals.length}</strong><span>next goals</span></div><div><strong>${pinned.length}/3</strong><span>pinned farms</span></div></div>
          <div class="slink-merit-controls"><label>Show<select data-merit-setting="filter"><option value="all">Honors + medals</option><option value="medal">Medals</option><option value="honor">Honors</option></select></label><label>Refresh<select data-merit-setting="refreshMinutes"><option value="5">5 minutes</option><option value="15">15 minutes</option><option value="30">30 minutes</option><option value="60">1 hour</option></select></label></div>
          ${pinned.length ? `<div class="slink-merit-section-title"><strong>Active farms</strong><span>${pinned.length}/3</span></div><div class="slink-merit-list">${pinned.map(goal => cardMarkup(goal, status, true)).join('')}</div>` : ''}
          <div class="slink-merit-section-title"><strong>Next milestones</strong><span>${goals.length}</span></div><div class="slink-merit-list">${unpinnedGoals.length ? unpinnedGoals.slice(0, 80).map(goal => cardMarkup(goal, status)).join('') : '<div class="slink-merit-unavailable">No other incomplete awards match this filter.</div>'}</div>`;
        const filter = ui.getContentElement().querySelector('[data-merit-setting="filter"]');
        const refresh = ui.getContentElement().querySelector('[data-merit-setting="refreshMinutes"]');
        filter.value = status.settings?.filter || 'all';
        refresh.value = String(status.settings?.refreshMinutes || 15);
      }

      async function load(refreshIfDue = true) {
        try { render(await SLINK.core.messaging.send('merits.status', { refreshIfDue })); }
        catch (error) { ui.setStatus(SLINK.core.format.errorMessage(error), 'error'); }
      }

      ui.getContentElement().addEventListener('click', async event => {
        const button = event.target.closest('[data-merit-pin]');
        if (!button) return;
        button.disabled = true;
        try { render(await SLINK.core.messaging.send('merits.pin', { key:button.dataset.meritPin })); }
        catch (error) { ui.setStatus(SLINK.core.format.errorMessage(error), 'error'); }
      });
      ui.getContentElement().addEventListener('change', async event => {
        if (!event.target.matches('[data-merit-setting]')) return;
        const payload = { [event.target.dataset.meritSetting]:event.target.value };
        try { render(await SLINK.core.messaging.send('merits.settings.save', payload)); }
        catch (error) { ui.setStatus(SLINK.core.format.errorMessage(error), 'error'); }
      });
      ui.setActions([{ id:'refresh', label:'Refresh Merits', onClick:async event => {
        event.currentTarget.disabled = true;
        try { render(await SLINK.core.messaging.send('merits.refresh')); }
        catch (error) { ui.setStatus(SLINK.core.format.errorMessage(error), 'error'); }
        finally { event.currentTarget.disabled = false; }
      } }]);
      await load(true);
      apiTimer = global.setInterval(() => { if (!stopped) void load(true); }, 60_000);
      clockTimer = global.setInterval(() => { if (!stopped) setStatus(); }, 1_000);
      return { stop() { stopped = true; if (apiTimer) global.clearInterval(apiTimer); if (clockTimer) global.clearInterval(clockTimer); } };
    }
  });
})(globalThis);
