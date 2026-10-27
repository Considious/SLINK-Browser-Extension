(function registerBounties(global) {
  'use strict';

  const SLINK = global.SLINK_EXTENSION;
  const ACTIVE_HEARTBEAT_MS = 60_000;
  const editorViews = new WeakMap();
  const AUTO_FIELDS = Object.freeze({
    'bounty-enabled':'enabled','bounty-minimum':'minimumReward','bounty-full-list':'scanFullList',
    'bounty-min-ff':'minFF','bounty-max-ff':'maxFF','bounty-max-bs':'maxBattleStats',
    'bounty-status-filter':'statusFilter','bounty-unknown':'includeUnknownEstimates','bounty-abroad':'includeAbroad',
    'bounty-torn-rate':'tornCallsPerMinute','bounty-ff-rate':'ffBatchesPerMinute'
  });
  const BOUNTY_PROFILE_INTENT_KEY = 'slink-extension:bounty-profile-intent:v1';
  const BOUNTY_PROFILE_INTENT_MS = 5 * 60_000;
  const MODULE_STYLES = `
    .bounty-summary { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:5px; }
    .bounty-stat { padding:6px; border-radius:6px; background:#202c39; text-align:center; }
    .bounty-stat b { display:block; font-size:13px; }
    .bounty-stat span { color:#8fa3b6; font-size:9px; }
    .bounty-note,.bounty-error { margin-top:7px; padding:7px; border-radius:6px; background:#202c39; color:#a9d5ff; }
    .bounty-error { background:#432929; color:#ffc0c0; }
    .bounty-settings { display:grid; grid-template-columns:1fr 1fr; gap:7px; margin-top:7px; }
    .bounty-settings label { display:grid; gap:3px; color:#9eb0c2; }
    .bounty-settings input,.bounty-settings select { min-width:0; padding:6px; border:1px solid #45586b; border-radius:5px; background:#111821; color:#edf7ff; }
    .bounty-settings .wide,.bounty-settings-actions { grid-column:1/-1; }
    .bounty-check { display:flex !important; grid-template-columns:none !important; flex-direction:row; align-items:flex-start; gap:7px !important; color:#e6f0f8 !important; }
    .bounty-check input { margin-top:2px; }
    .bounty-settings-actions { display:flex; flex-wrap:wrap; gap:6px; }
    .bounty-target { padding:8px 0; border-top:1px solid rgba(255,255,255,.08); }
    .bounty-target:first-child { border-top:0; }
    .bounty-head,.bounty-meta,.bounty-actions { display:flex; align-items:center; flex-wrap:wrap; gap:5px; }
    .bounty-head a { flex:1; color:#fff; font-weight:700; text-decoration:none; }
    .bounty-reward { color:#85ef9b; font-weight:700; }
    .bounty-meta { margin-top:4px; color:#9eb0c2; }
    .bounty-badge { padding:1px 5px; border-radius:8px; background:#303e4d; color:#e3edf6; }
    .bounty-badge[data-state="Hospital"] { background:#522c35; color:#ffc4cc; }
    .bounty-badge[data-state="Okay"] { background:#244b36; color:#b9f3cc; }
    .bounty-actions { margin-top:6px; }
    .bounty-actions a, .bounty-actions button { min-height:28px; padding:4px 7px; border:1px solid rgba(255,255,255,.15); border-radius:5px; background:#2b3745; color:#fff; text-decoration:none; }
    .bounty-empty { padding:14px 3px; color:#9eb0c2; text-align:center; }
    @media (max-width:420px) { .bounty-settings { grid-template-columns:1fr; } .bounty-summary { grid-template-columns:repeat(2,minmax(0,1fr)); } }
  `;

  function escape(value) {
    return SLINK.core.format.escapeHtml(String(value ?? ''));
  }

  function parseRemainingMs(text) {
    const lower = String(text || '').toLowerCase();
    return [
      [/([0-9]+)\s*d(?:ay)?s?/, 86_400_000],
      [/([0-9]+)\s*h(?:our)?s?/, 3_600_000],
      [/([0-9]+)\s*m(?:in(?:ute)?)?s?/, 60_000],
      [/([0-9]+)\s*s(?:ec(?:ond)?)?s?/, 1_000]
    ].reduce((total, [pattern, unit]) => total + (lower.match(pattern) ? Number(lower.match(pattern)[1]) * unit : 0), 0);
  }

  function detectState(text) {
    const lower = String(text || '').toLowerCase();
    if (lower.includes('federal jail')) return 'Federal';
    if (lower.includes('hiding out')) return 'Hiding Out';
    if (lower.includes('hospitalized') || lower.includes('in hospital')) return 'Hospital';
    if (lower.includes('traveling') || lower.includes('flying')) return 'Traveling';
    if (lower.includes('abroad')) return 'Abroad';
    if (lower.includes('okay')) return 'Okay';
    return '';
  }

  function rememberBountyProfileIntent(id) {
    SLINK.core.playerIntelligenceDom.rememberIntent(id, 'bounties');
  }

  SLINK.modules.register({
    id:'bounties',
    title:'SLINK Bounties',
    shortTitle:'Bounties',
    group:'combat',
    groupTitle:'Combat',
    defaultShowInTorn:true,
    requiredScopes:['slink.combat.bounties'],
    matches:url => url.hostname === 'www.torn.com',

    async start(context) {
      let current = null;
      let busy = false;
      let settingsOpen = false;
      let savingSettings = false;
      let settingsRevision = 0;
      let localNotice = '';
      let stopped = false;
      let localError = '';
      let scanTimer = null;
      let heartbeatTimer = null;
      let countdownTimer = null;
      let visibilityObserver = null;
      let autoSave = null;
      let responseSequence = 0, appliedResponse = 0;
      let mountedSettings = null, actionState = '', renderedResults = '';
      let resumeAfterSave = false, restarting = false;
      let scanDeferred = false;
      let previewPending=false,previewTimer=null;

      context.ui.setTitle('SLINK Bounties');
      context.ui.setModuleStyles(MODULE_STYLES);
      const contentRoot = context.ui.getContentElement();
      const retainedEditor = editorViews.get(contentRoot);
      if (retainedEditor) settingsOpen = retainedEditor.settingsOpen;
      contentRoot.dataset.uiExplicitCommit = 'true';
      const draftGuard = SLINK.core.formState?.protect(contentRoot.getRootNode?.() || contentRoot);

      // Scan/activity responses may have captured settings before a save. Keep
      // their runtime results, but never let those old settings undo an ack.
      async function loadStatus(type, payload) {
        const revision = settingsRevision;
        const value = await SLINK.core.messaging.send(type, payload);
        if (stopped || context.signal?.aborted) return;
        current = revision === settingsRevision || !current ? value : {
          ...value, settings:current.settings,
          runtime:{...value.runtime,candidates:current.runtime?.candidates||[],candidateCount:current.runtime?.candidateCount||0}
        };
        if(revision===settingsRevision&&value.runtime){previewPending=false;clearTimeout(previewTimer);previewTimer=null;}
      }

      async function savePatch(patch, deferScanRestart = true) {
        const sequence = ++responseSequence;
        settingsRevision++;
        try { return { sequence, status:await SLINK.core.messaging.send('bounties.settings.save', {...patch,...(deferScanRestart ? {deferScanRestart:true} : {})}) }; }
        finally { settingsRevision++; }
      }

      function adoptSaved(patch, response) {
        if (stopped || context.signal?.aborted) return;
        current = {...current,settings:{...current.settings,...patch}};
        if (response.sequence >= appliedResponse) {
          appliedResponse = response.sequence;
          current = {...current,...(response.status.runtime?{runtime:response.status.runtime}:{}),configured:response.status.configured};
          if(response.status.runtime){previewPending=false;clearTimeout(previewTimer);previewTimer=null;}
          else previewPending=true;
        }
        if (Object.hasOwn(patch,'enabled')) resumeAfterSave = true;
        render();
      }

      function autosaveState() {
        if (stopped || context.signal?.aborted || !autoSave) return;
        const status = autoSave.state();
        const node = contentRoot.querySelector('#bounty-autosave-state');
        const message=status.state === 'saving' ? 'Saving…' : status.state === 'failed' ? `Save failed: ${status.error}` : status.state === 'invalid' ? 'Not saved — enter a valid number.' : status.state === 'saved' ? 'Saved' : 'Settings save automatically';
        if (node&&node.textContent!==message) node.textContent=message;
        const retry = contentRoot.querySelector('#bounty-retry');
        if (retry) retry.hidden = status.state !== 'failed';
        if (!status.pending && resumeAfterSave) { resumeAfterSave=false;syncActivity(); }
        else if (!status.pending && scanDeferred && !savingSettings) {scanDeferred=false;scheduleScan(1000);}
        if(!status.pending&&previewPending&&!previewTimer&&moduleVisible()){
          previewTimer=setTimeout(()=>{
            previewTimer=null;
            if(stopped||context.signal?.aborted||autoSave.busy)return;
            previewPending=false;
            void loadStatus('bounties.status').then(render).catch(error=>{localError=SLINK.core.format.errorMessage(error);render();});
          },250);
        }
      }

      async function toggleSettings() {
        if (settingsOpen) {
          try { await autoSave.flush(); }
          catch (error) { localError=SLINK.core.format.errorMessage(error);render();return; }
          for (const id of ['bounty-torn-key','bounty-ff-key']) {
            const control = contentRoot.querySelector('#'+id);if (control) draftGuard?.cancel(control);
          }
        }
        settingsOpen=!settingsOpen;localNotice='';render();
      }

      async function refreshWithSettings() {
        if (busy || savingSettings || restarting) return;
        restarting=true;render();
        try {await autoSave.flush();await runScan(true);}
        catch(error){localError=SLINK.core.format.errorMessage(error);}
        finally{restarting=false;render();}
      }

      function moduleVisible() {
        const view = context.ui.getContentElement()?.closest('.module-view');
        return Boolean(view && !view.hidden);
      }

      function settingsHtml() {
        const settings = current?.settings || {};
        return `<div class="bounty-settings">
          <label class="wide bounty-check"><input id="bounty-enabled" type="checkbox" ${settings.enabled ? 'checked' : ''}><span>Enable Bounty Tracker</span></label>
          <label>Minimum highest bounty<input id="bounty-minimum" type="number" min="1" step="50000" value="${Number(settings.minimumReward) || 300000}"></label>
          <label>Status<select id="bounty-status-filter">
            <option value="hide-hospital" ${settings.statusFilter === 'hide-hospital' ? 'selected' : ''}>Hide hospitalized</option>
            <option value="all" ${settings.statusFilter === 'all' ? 'selected' : ''}>All statuses</option>
            <option value="okay" ${settings.statusFilter === 'okay' ? 'selected' : ''}>Known okay only</option>
            <option value="hospital" ${settings.statusFilter === 'hospital' ? 'selected' : ''}>Hospital only</option>
          </select></label>
          <label>Minimum FF<input id="bounty-min-ff" type="number" min="1" max="3" step="0.1" value="${Number(settings.minFF) || 1}"></label>
          <label>Maximum FF<input id="bounty-max-ff" type="number" min="1" max="3" step="0.1" value="${Number(settings.maxFF) || 3}"></label>
          <label class="wide">Maximum estimated battle stats (0 = no cap)<input id="bounty-max-bs" type="number" min="0" step="100000" value="${Number(settings.maxBattleStats) || 0}"></label>
          <label>Torn calls / minute<input id="bounty-torn-rate" type="number" min="1" max="20" value="${Number(settings.tornCallsPerMinute) || 20}"></label>
          <label>FF batches / minute<input id="bounty-ff-rate" type="number" min="1" max="20" value="${Number(settings.ffBatchesPerMinute) || 5}"></label>
          <label class="wide bounty-check"><input id="bounty-full-list" type="checkbox" ${settings.scanFullList ? 'checked' : ''}><span>Scan the full list for bounty merits instead of stopping below the minimum</span></label>
          <label class="wide bounty-check"><input id="bounty-unknown" type="checkbox" ${settings.includeUnknownEstimates ? 'checked' : ''}><span>Show targets without FFScouter estimates</span></label>
          <label class="wide bounty-check"><input id="bounty-abroad" type="checkbox" ${settings.includeAbroad ? 'checked' : ''}><span>Show abroad, traveling, and hiding-out targets</span></label>
          <div class="wide bounty-note"><span id="bounty-autosave-state" role="status" aria-label="Personal preference save status">Settings save automatically</span> <button id="bounty-retry" type="button" hidden>Retry save</button></div>
          <label class="wide">Torn public API key<input id="bounty-torn-key" type="password" autocomplete="off" placeholder="${settings.hasTornKey ? `Saved via ${escape(settings.tornKeySource)} — blank keeps it` : 'Required; blank uses Leveling key'}"></label>
          <label class="wide">FFScouter key<input id="bounty-ff-key" type="password" autocomplete="off" placeholder="${settings.hasFfKey ? `Saved via ${escape(settings.ffKeySource)} — blank keeps it` : 'Blank uses Leveling key'}"></label>
          <div class="bounty-settings-actions"><button id="bounty-save" type="button" ${savingSettings ? 'disabled' : ''}>${savingSettings ? 'Saving keys…' : 'Save API keys'}</button><button id="bounty-restart" type="button" ${busy || savingSettings || restarting ? 'disabled' : ''}>Restart scan</button></div>
        </div>`;
      }

      function statusText(target) {
        const status = target?.status || {};
        if (status.state === 'Hospital' && Number(status.until) > 0) {
          return `<span data-bounty-until="${Number(status.until)}">Hospital</span>`;
        }
        return escape(status.label || status.state || 'Unknown');
      }

      function candidatesHtml(candidates) {
        if (!candidates?.length) return `<div class="bounty-empty">${busy ? 'Scanning and estimating targets…' : 'No targets are currently loaded. Press Refresh to start or restart the five-minute Bounty cycle.'}</div>`;
        return candidates.map(target => {
          const profile = `https://www.torn.com/profiles.php?XID=${encodeURIComponent(target.id)}`;
          const attack = `https://www.torn.com/page.php?sid=attack&user2ID=${encodeURIComponent(target.id)}`;
          return `<article class="bounty-target">
            <div class="bounty-head"><a href="${profile}" data-bounty-profile-id="${target.id}">${escape(target.name)} [${target.id}]</a><span class="bounty-reward">$${Number(target.highestReward).toLocaleString()}</span></div>
            <div class="bounty-meta">
              <span class="bounty-badge" data-state="${escape(target.status?.state || 'Unknown')}">${statusText(target)}</span>
              <span class="bounty-badge">Lv ${Number(target.level) || '?'}</span>
              <span class="bounty-badge">FF ${escape(SLINK.core.format.fairFightLabel(target))}</span>
              <span class="bounty-badge">BS ${target.bsEstimate ? escape(SLINK.core.format.shortNumber(target.bsEstimate)) : '?'}</span>
              ${Number(target.highestQuantity) > 1 ? `<span class="bounty-badge">×${Number(target.highestQuantity)}</span>` : ''}
            </div>
            <div class="bounty-actions"><a href="${profile}" data-bounty-profile-id="${target.id}">Profile</a><a href="${attack}">Attack</a><button data-bounty-save-target="${target.id}" type="button">Save Target</button></div>
          </article>`;
        }).join('');
      }

      function render() {
        if (stopped || context.signal?.aborted) return;
        editorViews.set(contentRoot, { settingsOpen });
        const runtime = current?.runtime || {};
        context.ui.setSubtitle(current?.settings?.enabled ? 'Live bounty API crawl' : 'Disabled');
        context.ui.setStatus(localError || runtime.lastError || localNotice || runtime.cycleStatus || 'Bounty Tracker ready.', localError || runtime.lastError ? 'error' : current?.configured ? 'ready' : 'normal');
        const nextActionState = `${busy}:${settingsOpen}:${savingSettings}:${restarting}`;
        if (actionState !== nextActionState) {
        actionState = nextActionState;
        context.ui.setActions([
          { id:'refresh', label:busy || restarting ? 'Working…' : 'Refresh', disabled:busy || savingSettings || restarting, onClick:refreshWithSettings },
          { id:'settings', label:settingsOpen ? 'Close settings' : 'Settings', onClick:toggleSettings }
        ]);
        }
        const results = candidatesHtml(runtime.candidates || []);
        if (mountedSettings === settingsOpen) {
          for (const [id,value] of [['bounty-scanned',runtime.scannedRows],['bounty-total',runtime.uniqueTargets],['bounty-count',runtime.candidateCount]]) {
            const node=contentRoot.querySelector('#'+id);const text=Number(value||0).toLocaleString();if(node&&node.textContent!==text)node.textContent=text;
          }
          if (results !== renderedResults) { contentRoot.querySelector('#bounty-results').innerHTML=results;renderedResults=results;bindEvents(false); }
          updateNotes();autosaveState();updateCountdowns();return;
        }
        mountedSettings = settingsOpen;renderedResults=results;
        context.ui.setContentHtml(`
          <div class="bounty-summary">
            <div class="bounty-stat"><b id="bounty-scanned">${Number(runtime.scannedRows || 0).toLocaleString()}</b><span>Rows scanned</span></div>
            <div class="bounty-stat"><b id="bounty-total">${Number(runtime.uniqueTargets || 0).toLocaleString()}</b><span>Unique targets</span></div>
            <div class="bounty-stat"><b id="bounty-count">${Number(runtime.candidateCount || 0).toLocaleString()}</b><span>Matches</span></div>
          </div>
          <div class="bounty-note" id="bounty-disabled" hidden>Enable the tracker to begin. It runs while this tab is open and for five minutes after you leave it.</div>
          <div class="bounty-note" id="bounty-configure" hidden>Add a Torn public key and FFScouter key. Existing Leveling keys are reused automatically.</div>
          <div class="bounty-error" id="bounty-error" hidden></div>
          ${settingsOpen ? settingsHtml() : ''}
          <div id="bounty-results">${results}</div>
        `);
        bindEvents();
        updateNotes();autosaveState();updateCountdowns();
        if(settingsOpen)autoSave?.mount();
      }

      function updateNotes() {
        for (const [id,visible] of [['bounty-disabled',!current?.settings?.enabled],['bounty-configure',!current?.configured&&current?.settings?.enabled]]) {
          const node=contentRoot.querySelector('#'+id);if(node)node.hidden=!visible;
        }
        const error=contentRoot.querySelector('#bounty-error');if(error){error.textContent=localError||current?.runtime?.lastError||'';error.hidden=!error.textContent;}
        const save=contentRoot.querySelector('#bounty-save');if(save){save.disabled=savingSettings;save.textContent=savingSettings?'Saving keys…':'Save API keys';}
        const restart=contentRoot.querySelector('#bounty-restart');if(restart)restart.disabled=busy||savingSettings||restarting;
        for(const [id,has,source] of [['bounty-torn-key','hasTornKey','tornKeySource'],['bounty-ff-key','hasFfKey','ffKeySource']]){
          const input=contentRoot.querySelector('#'+id);if(input)input.placeholder=current?.settings?.[has]?`Saved via ${current.settings[source]} — blank keeps it`:id==='bounty-torn-key'?'Required; blank uses Leveling key':'Blank uses Leveling key';
        }
      }

      function bindEvents(bindSettings = true) {
        const root = context.ui.getContentElement();
        root.querySelectorAll('[data-bounty-profile-id]').forEach(link => {
          if(context.presentation!=='dashboard')link.addEventListener('click', () => rememberBountyProfileIntent(link.dataset.bountyProfileId));
        });
        root.querySelectorAll('[data-bounty-save-target]').forEach(button => {
          button.addEventListener('click', async () => {
            const targetId = Number(button.dataset.bountySaveTarget);
            const target = (current?.runtime?.candidates || []).find(row => Number(row.id) === targetId);
            if (!target) return;
            const original = button.textContent;
            button.disabled = true;
            button.textContent = 'Saving…';
            try {
              await SLINK.core.messaging.send('targetList.add', {
                playerId:targetId,
                name:target.name,
                tags:['Target'],
                source:'bounties',
                sourceLabel:'Bounties',
                sourceContext:{
                  highestReward:Number(target.highestReward) || 0,
                  quantity:Number(target.highestQuantity) || 1
                },
                status:{
                  state:target.status?.state,
                  until:Number(target.status?.until) || 0,
                  description:target.status?.description || '',
                  source:'bounties'
                }
              });
              button.textContent = 'Saved';
              localError = '';
            } catch (error) {
              button.textContent = 'Save failed';
              localError = SLINK.core.format.errorMessage(error);
            } finally {
              setTimeout(() => {
                if (!button.isConnected) return;
                button.disabled = false;
                button.textContent = original;
              }, 1400);
            }
          });
        });
        if (!bindSettings) return;
        root.querySelector('#bounty-retry')?.addEventListener('click', () => { void autoSave.retry().catch(()=>{}); });
        root.querySelector('#bounty-save')?.addEventListener('click', async () => {
          if (savingSettings) return;
          const values = {
            tornKey:root.querySelector('#bounty-torn-key')?.value || '',
            ffKey:root.querySelector('#bounty-ff-key')?.value || ''
          };
          const payload = Object.fromEntries(Object.entries(values).filter(([,value])=>String(value).trim()!==''));
          if (!Object.keys(payload).length) {localNotice='No new API keys entered; saved keys were kept.';render();return;}
          const tickets = Object.entries({'bounty-torn-key':'tornKey','bounty-ff-key':'ffKey'}).filter(([,key])=>Object.hasOwn(payload,key)).map(([id])=>({id,ticket:draftGuard?.begin(root.querySelector('#'+id))}));
          savingSettings = true; localError = ''; localNotice = ''; render();
          try {
            const response = await savePatch(payload,false);
            for (const {id,ticket} of tickets) {
              const unchanged = ticket ? draftGuard.commit(ticket) : true;
              if (unchanged&&!stopped&&!context.signal?.aborted) {const input=root.querySelector('#'+id);if(input)input.value='';}
            }
            if (stopped || context.signal?.aborted) return;
            const metadata=Object.fromEntries(['hasTornKey','hasFfKey','tornKeySource','ffKeySource'].map(key=>[key,response.status.settings[key]]));
            adoptSaved(metadata,response);localNotice='API keys saved.';
          } catch (error) { localError = SLINK.core.format.errorMessage(error); }
          finally { savingSettings = false;render();if(scanDeferred&&!autoSave.busy&&!stopped){scanDeferred=false;scheduleScan(1000);} }
        });
        root.querySelector('#bounty-restart')?.addEventListener('click', async () => {
          if (busy || savingSettings || restarting) return;
          restarting=true;
          try { await autoSave.flush();await loadStatus('bounties.scan.reset');render();await runScan(true); }
          catch (error) { localError = SLINK.core.format.errorMessage(error); render(); }
          finally {restarting=false;render();}
        });
      }

      function updateCountdowns() {
        for (const node of context.ui.getContentElement().querySelectorAll('[data-bounty-until]')) {
          const seconds = Math.ceil(Number(node.dataset.bountyUntil) - Date.now() / 1000);
          node.textContent = seconds > 0 ? `Hospital · ${SLINK.core.format.formatHumanDuration(seconds)}` : 'Presumed Okay';
        }
      }

      async function refreshStatus() {
        await loadStatus('bounties.status');
        if (!current) return;
        if (!current.settings.enabled && !retainedEditor) settingsOpen = true;
        render();
      }

      async function touch() {
        try { await loadStatus('bounties.activity.touch'); }
        catch {}
      }

      function syncActivity() {
        clearInterval(heartbeatTimer);
        heartbeatTimer = null;
        if (stopped || context.signal?.aborted || !moduleVisible() || !current?.settings?.enabled) return;
        void touch();
        heartbeatTimer = setInterval(() => void touch(), ACTIVE_HEARTBEAT_MS);
        void runScan(false);
      }

      function scheduleScan(delay = 1_000) {
        clearTimeout(scanTimer);
        scanTimer = setTimeout(() => void runScan(false), delay);
      }

      async function runScan(force) {
        if (busy || stopped || context.signal?.aborted || !current?.settings?.enabled) return;
        if (savingSettings || autoSave?.busy) {scanDeferred=true;return;}
        if (force && moduleVisible()) await touch();
        if (stopped || context.signal?.aborted) return;
        if (!current?.active && !moduleVisible()) return;
        busy = true; localError = ''; render();
        try { await loadStatus('bounties.scan.batch', { forceRestart:force === true && current?.runtime?.completed === true }); }
        catch (error) { localError = SLINK.core.format.errorMessage(error); }
        finally {
          busy = false; render();
          if (!stopped && current?.settings?.enabled && (current?.active || moduleVisible())) {
            const runtime = current?.runtime || {};
            const delay = runtime.completed ? Math.max(1_000, Number(runtime.nextRefreshAt || Date.now() + 30_000) - Date.now()) : 1_000;
            scheduleScan(Math.min(delay, 60_000));
          }
        }
      }

      autoSave = SLINK.core.formState.autosave({
        root:contentRoot,fields:AUTO_FIELDS,read:key=>current?.settings?.[key],save:patch=>savePatch(patch),
        select:response=>response.status.settings,onCommit:adoptSaved,onState:autosaveState
      });
      await refreshStatus();
      const view = context.ui.getContentElement()?.closest('.module-view');
      if (view) {
        visibilityObserver = new MutationObserver(syncActivity);
        visibilityObserver.observe(view, { attributes:true, attributeFilter:['hidden'] });
      }
      countdownTimer = setInterval(updateCountdowns, 1_000);
      syncActivity();

      return Object.freeze({
        async stop() {
          stopped = true;
          clearTimeout(scanTimer);
          clearInterval(heartbeatTimer);
          clearInterval(countdownTimer);
          clearTimeout(previewTimer);
          visibilityObserver?.disconnect();
          await autoSave.stop();
        }
      });
    }
  });
})(globalThis);


