(function registerCompanyModule(global) {
  'use strict';

  const SLINK = global.SLINK_EXTENSION;
  if (!SLINK) throw new Error('SLINK runtime must load before Company.');
  const COMPANY = SLINK.core.company;

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, character => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[character]));
  }

  function number(value) {
    return Number.isFinite(Number(value)) ? Number(value).toLocaleString() : 'Unavailable';
  }

  function relativeTime(timestamp) {
    if (!Number(timestamp)) return 'not checked yet';
    const seconds = Math.max(0, Math.floor((Date.now() - Number(timestamp)) / 1000));
    return seconds < 60 ? `${seconds}s ago` : seconds < 3600 ? `${Math.floor(seconds / 60)}m ago` : `${Math.floor(seconds / 3600)}h ago`;
  }

  function privateChatPanel(employeeName) {
    const wanted = String(employeeName || '').trim().toLowerCase();
    if (!wanted) return null;
    return [...document.querySelectorAll('[id^="private-"]')].find(panel => {
      const labels = [...panel.querySelectorAll('[class*="title"],[class*="name"],header span')]
        .map(node => String(node.textContent || '').trim().toLowerCase())
        .filter(Boolean);
      return labels.some(label => label === wanted || label.startsWith(wanted + ' '));
    }) || null;
  }

  function setNativeValue(control, value) {
    const descriptor = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value');
    descriptor?.set?.call(control, value);
    control.dispatchEvent(new Event('input', { bubbles:true }));
    control.dispatchEvent(new Event('change', { bubbles:true }));
    control.focus();
  }

  function fillPrivateChat(employee, send = false) {
    const panel = privateChatPanel(employee.name);
    if (!panel) throw new Error(`Open ${employee.name}'s private chat first.`);
    const textarea = panel.querySelector('textarea[placeholder="Type your message here..."]');
    if (!textarea) throw new Error('The open private chat text box was not found.');
    setNativeValue(textarea, COMPANY.reminderText(employee));
    if (!send) return;
    const button = [...panel.querySelectorAll('button[type="button"]')]
      .find(candidate => !candidate.disabled && candidate.querySelector('svg[viewBox="0 0 18 18"]'));
    if (!button) throw new Error('The private chat Send button is not ready.');
    button.click();
  }

  SLINK.modules.register({
    id:'company',
    title:'Company & Job Points',
    shortTitle:'Company',
    group:'quality-of-life',
    groupTitle:'Quality of Life',
    requiredScopes:[COMPANY.SCOPE],
    defaultShowInTorn:true,
    matches:url => url.hostname === 'www.torn.com',
    async start(context) {
      const ui = context.ui;
      const root = ui.getContentElement();
      let status = null;
      let busy = false;
      let notice = '';

      ui.setModuleStyles(`
        .slink-company{display:grid;gap:8px}
        .slink-company-card{min-width:0;padding:10px;border:1px solid var(--slink-border-soft);border-radius:8px;background:var(--slink-bg-control)}
        .slink-company-head,.slink-company-actions{display:flex;gap:8px;align-items:flex-start;justify-content:space-between;flex-wrap:wrap}.slink-company-head>div{min-width:0;flex:1}.slink-company-head strong,.slink-company-head small{display:block}.slink-company-head small{margin-top:3px;color:var(--slink-muted);line-height:1.35}
        .slink-company-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:7px;margin-top:8px}
        .slink-company-grid>div{min-width:0;padding:7px;border:1px solid var(--slink-border-soft);border-radius:7px}.slink-company-grid span{display:block;margin-top:3px;color:var(--slink-muted);font-size:10px;line-height:1.3}.slink-company-grid strong{display:block;font-size:14px;overflow-wrap:anywhere}
        .slink-company-settings{display:flex;gap:8px;align-items:end;flex-wrap:wrap}.slink-company-settings label{display:grid;gap:3px;min-width:120px;flex:1}.slink-company-settings input{width:100%}
        .slink-company-list{display:grid;gap:6px}.slink-company-employee{display:grid;grid-template-columns:minmax(120px,1fr) auto;gap:7px;padding:8px;border:1px solid var(--slink-border-soft);border-radius:7px}
        .slink-company-employee small{display:block;color:var(--slink-muted)}.slink-company-actions{justify-content:flex-end}.slink-company-actions a,.slink-company-actions button{padding:4px 7px}
        @media(max-width:520px){.slink-company-grid{grid-template-columns:1fr}.slink-company-employee{grid-template-columns:1fr}}
      `);

      function render() {
        const snapshot = status?.snapshot;
        const settings = status?.settings || COMPANY.DEFAULT_SETTINGS;
        if (!snapshot) {
          root.innerHTML = `<div class="slink-company"><article class="slink-company-card"><strong>Company &amp; Job Points</strong><p>${escapeHtml(status?.lastError || 'Refresh to load your current company information.')}</p><button type="button" data-company-refresh>${busy ? 'Checking…' : 'Refresh'}</button></article></div>`;
          return;
        }
        const selfPenalty = snapshot.self?.addictionPenalty;
        const ranked = snapshot.director ? COMPANY.rankTrainCandidates(snapshot.employees) : [];
        root.innerHTML = `<div class="slink-company">
          <article class="slink-company-card">
            <div class="slink-company-head"><div><strong>${escapeHtml(snapshot.company.name || 'Current company')}</strong><small>${escapeHtml(snapshot.company.position || 'Employee')} · ${snapshot.company.rating ? snapshot.company.rating + '★' : 'rating unavailable'}</small></div><button type="button" data-company-refresh>${busy ? 'Checking…' : 'Refresh'}</button></div>
            <div class="slink-company-grid"><div><span>Job points</span><strong>${number(snapshot.company.jobPoints)}</strong></div><div><span>Days in company</span><strong>${number(snapshot.company.daysInCompany)}</strong></div><div><span>Your addiction penalty</span><strong>${selfPenalty === null ? 'Unavailable' : '-' + number(selfPenalty)}</strong></div><div><span>Updated</span><strong>${relativeTime(status.fetchedAt)}</strong></div></div>
          </article>
          <article class="slink-company-card">
            <div class="slink-company-settings"><label>Your addiction alert threshold<input type="number" min="1" max="100" step="1" data-company-own-threshold value="${escapeHtml(settings.addictionThreshold)}"></label>${snapshot.director ? `<label>Employee alert threshold<input type="number" min="1" max="100" step="1" data-company-director-threshold value="${escapeHtml(settings.directorThreshold)}"></label>` : ''}<button type="button" data-company-save>Save alerts</button></div>
            ${notice ? `<p>${escapeHtml(notice)}</p>` : ''}
          </article>
          ${snapshot.director ? `<article class="slink-company-card"><div class="slink-company-head"><div><strong>Director view</strong><small>Train priority is an estimate based on working-stat effectiveness headroom; it is not an exact stat-gain promise.</small></div><span>${ranked.length} employees ranked</span></div><div class="slink-company-list">${ranked.map((employee, index) => `<div class="slink-company-employee"><div><strong>#${index + 1} ${escapeHtml(employee.name)}</strong><small>${escapeHtml(employee.position || 'Employee')} · addiction ${employee.addictionPenalty === null ? 'unavailable' : '-' + employee.addictionPenalty} · effectiveness ${employee.totalEffectiveness === null ? 'unavailable' : employee.totalEffectiveness} · train headroom ${employee.trainHeadroom}</small></div><div class="slink-company-actions"><a href="https://www.torn.com/messages.php#/p=compose&amp;XID=${employee.id}" target="_blank" rel="noopener">Message</a><a href="https://www.torn.com/profiles.php?XID=${employee.id}" target="_blank" rel="noopener">Open profile/chat</a><button type="button" data-company-fill-chat="${employee.id}">Fill chat</button><button type="button" data-company-send-chat="${employee.id}">Send chat</button></div></div>`).join('') || '<p>No extended employee effectiveness data is available.</p>'}</div></article>` : ''}
        </div>`;
      }

      async function load(force = false) {
        if (busy) return;
        busy = true; notice = ''; render();
        try {
          status = await SLINK.core.messaging.send(force ? 'company.refresh' : 'company.status', { refreshIfDue:true });
          ui.setStatus(status?.lastError || 'Company information is ready.', status?.lastError ? 'error' : 'ready');
        } catch (error) {
          notice = SLINK.core.format.errorMessage(error);
          ui.setStatus(notice, 'error');
        } finally {
          busy = false; render();
        }
      }

      async function save() {
        const addictionThreshold = Number(root.querySelector('[data-company-own-threshold]')?.value);
        const directorThreshold = Number(root.querySelector('[data-company-director-threshold]')?.value ?? status?.settings?.directorThreshold);
        status = await SLINK.core.messaging.send('company.settings.save', { settings:{ addictionThreshold, directorThreshold } });
        notice = 'Company alert thresholds saved.';
        render();
      }

      context.listen(root, 'click', event => {
        if (event.target.closest('[data-company-refresh]')) void load(true);
        if (event.target.closest('[data-company-save]')) void save().catch(error => { notice = SLINK.core.format.errorMessage(error); render(); });
        const fill = event.target.closest('[data-company-fill-chat],[data-company-send-chat]');
        if (fill) {
          const id = Number(fill.dataset.companyFillChat || fill.dataset.companySendChat);
          const employee = status?.snapshot?.employees?.find(row => row.id === id);
          try {
            fillPrivateChat(employee, Boolean(fill.dataset.companySendChat));
            notice = fill.dataset.companySendChat ? `Reminder sent to ${employee.name}.` : `Reminder placed in ${employee.name}'s open chat.`;
          } catch (error) { notice = SLINK.core.format.errorMessage(error); }
          render();
        }
      });

      await load(false);
      return { stop() {} };
    }
  });
})(globalThis);
