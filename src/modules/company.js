(function registerCompanyModule(global) {
  'use strict';

  const SLINK = global.SLINK_EXTENSION;
  if (!SLINK) throw new Error('SLINK runtime must load before Company.');
  const COMPANY = SLINK.core.company;
  const primedReminders = new WeakMap();

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, character => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[character]));
  }

  function number(value) {
    if (value === null || value === undefined || value === '' || typeof value === 'boolean') return 'Unavailable';
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

  function fillPrivateChat(employee, send = false, companyId = 0) {
    if (!(Number(employee?.id) > 0) || !(companyId > 0)) throw new Error('Current company and employee identity are required.');
    const panel = privateChatPanel(employee.name);
    if (!panel) throw new Error(`Open ${employee.name}'s private chat first.`);
    const textarea = panel.querySelector('textarea[placeholder="Type your message here..."]');
    if (!textarea) throw new Error('The open private chat text box was not found.');
    const text = COMPANY.reminderText(employee);
    if (!send) {
      setNativeValue(textarea, text);
      primedReminders.set(textarea,{employeeId:employee.id,companyId,text});
      return;
    }
    const primed = primedReminders.get(textarea);
    if (!primed || primed.employeeId !== employee.id || primed.companyId !== companyId || primed.text !== text || textarea.value !== primed.text) {
      primedReminders.delete(textarea);
      throw new Error('Click Fill chat first. A changed reminder or edited draft will not be overwritten or sent.');
    }
    const button = [...panel.querySelectorAll('button[type="button"]')]
      .find(candidate => !candidate.disabled && candidate.getAttribute('aria-disabled') !== 'true' && SLINK.core.factionChat.isSendButton(candidate));
    if (!button) throw new Error('The private chat Send button is not ready.');
    primedReminders.delete(textarea);
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
      let copying = false;
      let stopped = false;
      let settingsRevision = 0;
      let editorLayout = null;
      let saveState = { state:'idle' };
      root.innerHTML = '<div class="slink-company"><div data-company-overview></div><div data-company-editor></div><div data-company-director></div><p data-company-notice role="status"></p><label data-company-copy-fallback hidden>Copy reminder manually<textarea readonly data-company-copy-text rows="3"></textarea></label></div>';
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
        [data-company-copy-fallback]{display:grid;gap:5px}[data-company-copy-fallback][hidden]{display:none}[data-company-copy-text]{width:100%;min-width:0;box-sizing:border-box}
        @media(max-width:520px){.slink-company-grid{grid-template-columns:1fr}.slink-company-employee{grid-template-columns:1fr}}
      `);

      function renderDirector(snapshot, ranked) {
        const holder=root.querySelector('[data-company-director]');
        if(!snapshot.director){holder.replaceChildren();return;}
        const identity=String(snapshot.company.id||'');
        if(holder.dataset.companyId!==identity||!holder.querySelector('[data-company-employees]')){
          holder.dataset.companyId=identity;
          holder.innerHTML='<article class="slink-company-card"><div class="slink-company-head"><div><strong>Director view</strong><small>Train priority estimates working-stat effectiveness headroom, not exact stat gains.</small></div><span data-company-ranked></span></div><div class="slink-company-list" data-company-employees></div></article>';
        }
        holder.querySelector('[data-company-ranked]').textContent=ranked.length+' employees ranked';
        const list=holder.querySelector('[data-company-employees]'),present=new Set(),ordered=[];
        ranked.forEach((employee,index)=>{
          const id=String(employee.id);present.add(id);
          let row=[...list.children].find(node=>node.dataset.companyEmployee===id);
          if(!row){
            row=document.createElement('div');row.className='slink-company-employee';row.dataset.companyEmployee=id;
            row.innerHTML='<div><strong></strong><small></small></div><div class="slink-company-actions"><a data-company-message target="_blank" rel="noopener">Message</a><a data-company-profile target="_blank" rel="noopener">Open profile/chat</a><button type="button" data-company-fill-chat="'+escapeHtml(id)+'">'+(dashboard?'Copy reminder':'Fill chat')+'</button>'+(dashboard?'':'<button type="button" data-company-send-chat="'+escapeHtml(id)+'">Send chat</button>')+'</div>';
            list.append(row);
          }
          const title='#'+(index+1)+' '+employee.name,detail=(employee.position||'Employee')+' · addiction '+(employee.addictionPenalty===null?'unavailable':'-'+employee.addictionPenalty)+' · effectiveness '+(employee.totalEffectiveness===null?'unavailable':employee.totalEffectiveness)+' · train headroom '+employee.trainHeadroom;
          if(row.querySelector('strong').textContent!==title)row.querySelector('strong').textContent=title;
          if(row.querySelector('small').textContent!==detail)row.querySelector('small').textContent=detail;
          row.querySelector('[data-company-message]').href='https://www.torn.com/messages.php#/p=compose&XID='+encodeURIComponent(id);
          row.querySelector('[data-company-profile]').href='https://www.torn.com/profiles.php?XID='+encodeURIComponent(id);
          row.querySelector('[data-company-fill-chat]').disabled=copying;
          ordered.push(row);
        });
        for(const row of [...list.children])if(!present.has(row.dataset.companyEmployee))row.remove();
        let focused=document.activeElement;while(focused?.shadowRoot?.activeElement)focused=focused.shadowRoot.activeElement;
        if(!copying&&!list.contains(focused))ordered.forEach((row,index)=>{if(list.children[index]!==row)list.insertBefore(row,list.children[index]||null);});
      }

      function render() {
        if(stopped || context.signal?.aborted)return;
        const snapshot = status?.snapshot;
        if (!snapshot?.director) root.querySelector('[data-company-copy-fallback]').hidden = true;
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
            <div class="slink-company-grid"><div><span>Job points</span><strong>${number(snapshot.company.jobPoints)}</strong></div><div><span>Days in company</span><strong>${number(snapshot.company.daysInCompany)}</strong></div><div><span>Your addiction penalty</span><strong>${selfPenalty == null ? 'Unavailable' : '-' + number(selfPenalty)}</strong></div><div><span>Updated</span><strong>${relativeTime(status.fetchedAt)}</strong></div></div>
          </article>`);
        const layout = JSON.stringify([snapshot.company.id, Boolean(snapshot.director)]);
        if (editorLayout !== layout) {
          patch('[data-company-editor]', `<article class="slink-company-card"><div class="slink-company-settings"><label>Your addiction alert threshold<input id="company-own-threshold" type="number" min="1" max="100" step="1" data-company-own-threshold value="${escapeHtml(settings.addictionThreshold)}"></label>${snapshot.director ? `<label>Employee alert threshold<input id="company-director-threshold" type="number" min="1" max="100" step="1" data-company-director-threshold value="${escapeHtml(settings.directorThreshold)}"></label>` : ''}</div><div class="slink-company-save-status"><span role="status" data-company-save-state></span><button type="button" data-company-retry hidden>Retry</button></div></article>`);
          editorLayout = layout;
          autosave.mount();
        }
        renderDirector(snapshot,ranked);
        root.querySelector('[data-company-notice]').textContent = notice;
        renderSaveState();
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
          if (!status?.snapshot?.director || copying) return;
          const id = Number(fill.dataset.companyFillChat || fill.dataset.companySendChat);
          const employee = status?.snapshot?.employees?.find(row => row.id === id);
          if (!employee) return;
          const companyId=String(status.snapshot.company.id||'');
          try {
            if(dashboard){
              copying=true;fill.disabled=true;
              const text=COMPANY.reminderText(employee);
              const copied=await SLINK.core.clipboard.copyText(text);
              if(stopped||context.signal?.aborted||!status?.snapshot?.director||String(status.snapshot.company.id||'')!==companyId)return;
              const fallback=root.querySelector('[data-company-copy-fallback]');fallback.hidden=copied;
              if(!copied)root.querySelector('[data-company-copy-text]').value=text;
              notice=copied?'Reminder copied. Open the employee profile/chat and paste it manually.':'Copy blocked. Select and copy the reminder below.';
              render();return;
            }
            fillPrivateChat(employee, Boolean(fill.dataset.companySendChat), Number(status.snapshot.company.id));
            notice = fill.dataset.companySendChat ? `Reminder sent to ${employee.name}.` : `Reminder placed in ${employee.name}'s open chat.`;
          } catch (error) { if(!stopped&&!context.signal?.aborted)notice = SLINK.core.format.errorMessage(error); }
          finally { copying=false;fill.disabled=false; }
          render();
        }
      });

      await load(false);
      return { async stop() { stopped = true; await autosave.stop(); } };
    }
  });
})(globalThis);
