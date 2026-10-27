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
      const dashboard=context.presentation==='dashboard';
      let status = null;
      let busy = false;
      let notice = '';
      let stopped = false;
      let settingsRevision = 0;
      let editorLayout = null;
      let saveState = { state:'idle' };
      root.innerHTML = '<div class="slink-company"><div data-company-overview></div><div data-company-editor></div><div data-company-director></div><p data-company-notice role="status"></p></div>';
      const patch = (selector, html) => {
        const node = root.querySelector(selector);
        if (node.innerHTML !== html) node.innerHTML = html;
      };
      function renderSaveState() {
        if (stopped || context.signal?.aborted) return;
        const node = root.querySelector('[data-company-save-state]');
        if (!node) return;
        node.textContent = ({ idle:'Changes save automatically.', saving:'Saving…', saved:'Saved.', invalid:'Enter a complete number before saving.', failed:'Not saved. Retry your changes.', unsaved:'Changes not saved yet.' })[saveState.state] || '';
        const retry = root.querySelector('[data-company-retry]');
        retry.hidden = saveState.state !== 'failed';
      }
      const autosave = SLINK.core.formState.autosave({
        root,
        fields:{ 'company-own-threshold':'addictionThreshold', 'company-director-threshold':'directorThreshold' },
        read:key => status?.settings?.[key],
        select:response => response.settings,
        async save(settings) {
          settingsRevision++;
          try { return await SLINK.core.messaging.send('company.settings.save', {settings}); }
          finally { settingsRevision++; }
        },
        onCommit:settings => { status = { ...status, settings:{ ...status?.settings, ...settings } }; },
        onState:state => { saveState = state; renderSaveState(); }
      });

      ui.setModuleStyles(`
        .slink-company{display:grid;gap:8px}
        .slink-company-card{min-width:0;padding:10px;border:1px solid var(--slink-border-soft);border-radius:8px;background:var(--slink-bg-control)}
        .slink-company-head,.slink-company-actions{display:flex;gap:8px;align-items:flex-start;justify-content:space-between;flex-wrap:wrap}.slink-company-head>div{min-width:0;flex:1}.slink-company-head strong,.slink-company-head small{display:block}.slink-company-head small{margin-top:3px;color:var(--slink-muted);line-height:1.35}
        .slink-company-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:7px;margin-top:8px}
        .slink-company-grid>div{min-width:0;padding:7px;border:1px solid var(--slink-border-soft);border-radius:7px}.slink-company-grid span{display:block;margin-top:3px;color:var(--slink-muted);font-size:10px;line-height:1.3}.slink-company-grid strong{display:block;font-size:14px;overflow-wrap:anywhere}
        .slink-company-settings{display:flex;gap:8px;align-items:end;flex-wrap:wrap}.slink-company-settings label{display:grid;gap:3px;min-width:120px;flex:1}.slink-company-settings input{width:100%;box-sizing:border-box}.slink-company-save-status{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-top:8px}
        .slink-company-list{display:grid;gap:6px}.slink-company-employee{display:grid;grid-template-columns:minmax(120px,1fr) auto;gap:7px;padding:8px;border:1px solid var(--slink-border-soft);border-radius:7px}
        .slink-company-employee small{display:block;color:var(--slink-muted)}.slink-company-actions{justify-content:flex-end}.slink-company-actions a,.slink-company-actions button{padding:4px 7px}
        @media(max-width:520px){.slink-company-grid{grid-template-columns:1fr}.slink-company-employee{grid-template-columns:1fr}}
      `);

      function render() {
        if(stopped || context.signal?.aborted)return;
        const snapshot = status?.snapshot;
        const settings = status?.settings || COMPANY.DEFAULT_SETTINGS;
        if (!snapshot) {
          patch('[data-company-overview]', `<article class="slink-company-card"><strong>Company &amp; Job Points</strong><p>${escapeHtml(status?.lastError || 'Refresh to load your current company information.')}</p><button type="button" data-company-refresh>${busy ? 'Checking…' : 'Refresh'}</button></article>`);
          patch('[data-company-editor]', ''); patch('[data-company-director]', ''); editorLayout = null;
          root.querySelector('[data-company-notice]').textContent = notice;
          return;
        }
        const selfPenalty = snapshot.self?.addictionPenalty;
        const ranked = snapshot.director ? COMPANY.rankTrainCandidates(snapshot.employees) : [];
        patch('[data-company-overview]', `<article class="slink-company-card">
            <div class="slink-company-head"><div><strong>${escapeHtml(snapshot.company.name || 'Current company')}</strong><small>${escapeHtml(snapshot.company.position || 'Employee')} · ${snapshot.company.rating ? snapshot.company.rating + '★' : 'rating unavailable'}</small></div><button type="button" data-company-refresh>${busy ? 'Checking…' : 'Refresh'}</button></div>
            <div class="slink-company-grid"><div><span>Job points</span><strong>${number(snapshot.company.jobPoints)}</strong></div><div><span>Days in company</span><strong>${number(snapshot.company.daysInCompany)}</strong></div><div><span>Your addiction penalty</span><strong>${selfPenalty === null ? 'Unavailable' : '-' + number(selfPenalty)}</strong></div><div><span>Updated</span><strong>${relativeTime(status.fetchedAt)}</strong></div></div>
          </article>`);
        const layout = JSON.stringify([snapshot.company.id, Boolean(snapshot.director)]);
        if (editorLayout !== layout) {
          patch('[data-company-editor]', `<article class="slink-company-card"><div class="slink-company-settings"><label>Your addiction alert threshold<input id="company-own-threshold" type="number" min="1" max="100" step="1" data-company-own-threshold value="${escapeHtml(settings.addictionThreshold)}"></label>${snapshot.director ? `<label>Employee alert threshold<input id="company-director-threshold" type="number" min="1" max="100" step="1" data-company-director-threshold value="${escapeHtml(settings.directorThreshold)}"></label>` : ''}</div><div class="slink-company-save-status"><span role="status" data-company-save-state></span><button type="button" data-company-retry hidden>Retry</button></div></article>`);
          editorLayout = layout;
          autosave.mount();
        }
        patch('[data-company-director]', snapshot.director ? `<article class="slink-company-card"><div class="slink-company-head"><div><strong>Director view</strong><small>Train priority is an estimate based on working-stat effectiveness headroom; it is not an exact stat-gain promise.</small></div><span>${ranked.length} employees ranked</span></div><div class="slink-company-list">${ranked.map((employee, index) => `<div class="slink-company-employee"><div><strong>#${index + 1} ${escapeHtml(employee.name)}</strong><small>${escapeHtml(employee.position || 'Employee')} · addiction ${employee.addictionPenalty === null ? 'unavailable' : '-' + employee.addictionPenalty} · effectiveness ${employee.totalEffectiveness === null ? 'unavailable' : employee.totalEffectiveness} · train headroom ${employee.trainHeadroom}</small></div><div class="slink-company-actions"><a href="https://www.torn.com/messages.php#/p=compose&amp;XID=${employee.id}" target="_blank" rel="noopener">Message</a><a href="https://www.torn.com/profiles.php?XID=${employee.id}" target="_blank" rel="noopener">Open profile/chat</a><button type="button" data-company-fill-chat="${employee.id}">Fill chat</button><button type="button" data-company-send-chat="${employee.id}">Send chat</button></div></div>`).join('') || '<p>No extended employee effectiveness data is available.</p>'}</div></article>` : '');
        root.querySelector('[data-company-notice]').textContent = notice;
        renderSaveState();
        if(dashboard){
          root.querySelectorAll('[data-company-fill-chat]').forEach(button=>{button.textContent='Copy reminder';});
          root.querySelectorAll('[data-company-send-chat]').forEach(button=>{button.hidden=true;});
        }
      }

      async function load(force = false) {
        if (busy) return;
        busy = true; notice = ''; render();
        const revision = settingsRevision;
        try {
          const response = await SLINK.core.messaging.send(force ? 'company.refresh' : 'company.status', { refreshIfDue:true });
          if (stopped || context.signal?.aborted) return;
          status = { ...response, settings:revision === settingsRevision && !autosave.busy ? response.settings : status?.settings || response.settings };
          ui.setStatus(status?.lastError || 'Company information is ready.', status?.lastError ? 'error' : 'ready');
        } catch (error) {
          if (stopped || context.signal?.aborted) return;
          notice = SLINK.core.format.errorMessage(error);
          ui.setStatus(notice, 'error');
        } finally {
          busy = false; render();
        }
      }

      context.listen(root, 'click', async event => {
        if (stopped || context.signal?.aborted) return;
        if (event.target.closest('[data-company-refresh]')) void load(true);
        if (event.target.closest('[data-company-retry]')) void autosave.retry().catch(() => {});
        const fill = event.target.closest('[data-company-fill-chat],[data-company-send-chat]');
        if (fill) {
          const id = Number(fill.dataset.companyFillChat || fill.dataset.companySendChat);
          const employee = status?.snapshot?.employees?.find(row => row.id === id);
          try {
            if(dashboard){await navigator.clipboard.writeText(COMPANY.reminderText(employee));notice='Reminder copied. Open the employee profile/chat and paste it manually.';render();return;}
            fillPrivateChat(employee, Boolean(fill.dataset.companySendChat));
            notice = fill.dataset.companySendChat ? `Reminder sent to ${employee.name}.` : `Reminder placed in ${employee.name}'s open chat.`;
          } catch (error) { notice = SLINK.core.format.errorMessage(error); }
          render();
        }
      });

      await load(false);
      return { async stop() { stopped = true; await autosave.stop(); } };
    }
  });
})(globalThis);
