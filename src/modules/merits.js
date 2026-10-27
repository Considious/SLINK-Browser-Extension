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

      const root = ui.getContentElement(), guard = SLINK.core.formState.protect(root.getRootNode());
      const previousExplicit = root.dataset.uiExplicitCommit; root.dataset.uiExplicitCommit = 'true';
      let mounted = false, settingsRevision = 0, requestSequence = 0;
      const preferences = SLINK.core.formState.autosave({
        root,fields:{'merits-view-filter':'filter','merits-view-refresh':'refreshMinutes'},read:key => current?.settings?.[key],
        async save(patch) {settingsRevision++;try {return await SLINK.core.messaging.send('merits.settings.save',{...patch,preferenceOnly:true});} finally {settingsRevision++;}},
        select:response => response.settings,
        onCommit:patch => {current = {...current,settings:{...current?.settings,...patch}};void load(false);},
        onState:state => {
          if (stopped || !mounted) return;
          root.querySelector('[data-merit-save-state]').textContent = ({idle:'Settings save automatically.',saving:'Saving…',saved:'Saved.',failed:'Not saved. Retry.',invalid:'Check your setting.',unsaved:'Changes not saved yet.'})[state.state] || '';
          root.querySelector('[data-merit-retry]').hidden = state.state !== 'failed';
        }
      });
      function render(status) {
        if (stopped || context.signal?.aborted) return;
        current = status; setStatus();
        if (!mounted) {
          root.innerHTML = '<div class="slink-merit-summary"></div><div class="slink-merit-controls"><label>Show<select id="merits-view-filter" data-merit-setting="filter"><option value="all">Honors + medals</option><option value="medal">Medals</option><option value="honor">Honors</option></select></label><label>Refresh<select id="merits-view-refresh" data-merit-setting="refreshMinutes"><option value="5">5 minutes</option><option value="15">15 minutes</option><option value="30">30 minutes</option><option value="60">1 hour</option></select></label></div><div role="status"><span data-merit-save-state></span> <button type="button" data-merit-retry hidden>Retry</button></div><div data-merit-goals></div>';
          root.querySelector('#merits-view-filter').value = status.settings?.filter || 'all';
          root.querySelector('#merits-view-refresh').value = String(status.settings?.refreshMinutes || 15);
          mounted = true; preferences.mount();
        }
        for (const [id,key] of [['merits-view-filter','filter'],['merits-view-refresh','refreshMinutes']]) {
          const control = root.querySelector('#'+id); guard.hydrate(control,status.settings?.[key]);
          control.disabled = !status.configured || !status.permitted;
        }
        const pinned = Array.isArray(status.pinned) ? status.pinned : [], goals = Array.isArray(status.goals) ? status.goals : [];
        const unpinned = goals.filter(goal => !status.settings?.pinned?.includes(goal.key));
        root.querySelector('.slink-merit-summary').innerHTML = '<div><strong>'+ (status.completedCount || 0) +'</strong><span>earned</span></div><div><strong>'+goals.length+'</strong><span>next goals</span></div><div><strong>'+pinned.length+'/3</strong><span>pinned farms</span></div>';
        const html = !status.configured || !status.permitted ? '<div class="slink-merit-unavailable">'+escapeHtml(status.lastError || 'Enable Efficiency and save your Torn API key in the extension dashboard.')+'</div>'
          : (pinned.length ? '<div class="slink-merit-section-title"><strong>Active farms</strong><span>'+pinned.length+'/3</span></div><div class="slink-merit-list">'+pinned.map(goal=>cardMarkup(goal,status,true)).join('')+'</div>' : '')
          + '<div class="slink-merit-section-title"><strong>Next milestones</strong><span>'+goals.length+'</span></div><div class="slink-merit-list">'+(unpinned.length ? unpinned.slice(0,80).map(goal=>cardMarkup(goal,status)).join('') : '<div class="slink-merit-unavailable">No other incomplete awards match this filter.</div>')+'</div>';
        const goalsRoot = root.querySelector('[data-merit-goals]');
        if (goalsRoot.innerHTML !== html) goalsRoot.innerHTML = html;
      }

      async function load(refreshIfDue = true) {
        const request = ++requestSequence, revision = settingsRevision;
        try {
          const status = await SLINK.core.messaging.send('merits.status',{refreshIfDue});
          if (request !== requestSequence || stopped) return;
          if (revision !== settingsRevision || preferences.busy) status.settings = {...status.settings,...current?.settings};
          render(status);
        } catch (error) {if (!stopped && request === requestSequence) ui.setStatus(SLINK.core.format.errorMessage(error),'error');}
      }
      context.listen(root,'click',async event => {
        const button = event.target.closest('[data-merit-pin],[data-merit-retry]'); if (!button || button.disabled || stopped) return;
        if (button.matches('[data-merit-retry]')) {await preferences.flush().catch(()=>{});return;}
        button.disabled = true; settingsRevision++;
        try {await preferences.flush();await SLINK.core.messaging.send('merits.pin',{key:button.dataset.meritPin});await load(false);}
        catch (error) {if (!stopped) ui.setStatus(SLINK.core.format.errorMessage(error),'error');}
        finally {settingsRevision++;if (!stopped) button.disabled = false;}
      });
      ui.setActions([{id:'refresh',label:'Refresh Merits',onClick:async event => {
        event.currentTarget.disabled = true;
        try {await preferences.flush();await SLINK.core.messaging.send('merits.refresh');await load(false);}
        catch (error) {if (!stopped) ui.setStatus(SLINK.core.format.errorMessage(error),'error');}
        finally {if (!stopped) event.currentTarget.disabled = false;}
      }}]);
      await load(false);
      apiTimer = global.setInterval(() => { if (!stopped) void load(true); }, 60_000);
      clockTimer = global.setInterval(() => { if (!stopped) setStatus(); }, 1_000);
      return { async stop() { stopped = true; await preferences.stop(); if (previousExplicit === undefined) delete root.dataset.uiExplicitCommit; else root.dataset.uiExplicitCommit = previousExplicit; if (apiTimer) global.clearInterval(apiTimer); if (clockTimer) global.clearInterval(clockTimer); } };
    }
  });
})(globalThis);
