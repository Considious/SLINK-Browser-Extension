(function registerAdhdModule(global) {
  'use strict';

  const SLINK = global.SLINK_EXTENSION;
  if (!SLINK) throw new Error('SLINK runtime must load before Efficiency.');

  function relativeTime(timestamp) {
    if (!Number(timestamp)) return 'not checked yet';
    const seconds = Math.max(0, Math.floor((Date.now() - Number(timestamp)) / 1000));
    return seconds < 60 ? `${seconds}s ago` : seconds < 3600 ? `${Math.floor(seconds / 60)}m ${seconds % 60}s ago` : `${Math.floor(seconds / 3600)}h ${Math.floor(seconds % 3600 / 60)}m ago`;
  }

  for (const crimes of [false,true]) SLINK.modules.register({
    id:crimes?'crimes':'adhd',
    title:crimes?'Crimes':'SLINK Efficiency',
    shortTitle:crimes?'Crimes':'Alerts',
    group:'efficiency',
    groupTitle:'Efficiency',
    requiredScopes:[SLINK.core.adhd.ALERT_SCOPE],
    defaultShowInTorn:true,
    matches:url => url.hostname === 'www.torn.com',
    async start(context) {
      const ui = context.ui;
      let stopped = false;
      let timer = null;
      let clockTimer = null;
      let current = null;
      let lastRenderSignature = null;
      let activeCrime='searchCashUnique';
      let arsonEnabled=false;
      const arson=crimes?SLINK.core.arsonPage?.connect({eligible:()=>!stopped&&!context.signal?.aborted&&context.isActive?.()!==false}):null;
      function applyArson(value){
        arsonEnabled=value===true;
        arson?.setEnabled(arsonEnabled);
        if(current&&!stopped)render(current);
      }
      function arsonStorageChanged(changes,area){
        const key=SLINK.STORAGE_PREFIX+'crimes.arson.enabled';
        if(area==='local'&&Object.hasOwn(changes,key))applyArson(changes[key].newValue);
      }
      if(arson){
        try{applyArson(await SLINK.core.storage.get('crimes.arson.enabled',false));}catch{}
        global.chrome?.storage?.onChanged?.addListener(arsonStorageChanged);
      }

      ui.setModuleStyles(`
        .slink-adhd-summary{display:grid;grid-template-columns:repeat(3,minmax(0,110px));justify-content:start;align-items:start;gap:5px;width:100%;min-width:0;max-width:100%}
        .slink-adhd-summary>div{width:100%;padding:7px;border:1px solid var(--slink-border-soft);border-radius:7px;background:var(--slink-bg-control);text-align:center}
        .slink-adhd-summary strong,.slink-adhd-summary small{display:block}.slink-adhd-summary small{color:var(--slink-muted)}
        .slink-adhd-list{display:grid;align-content:start;gap:7px;width:100%;min-width:0;max-width:100%}.slink-adhd-alert{width:100%;min-width:0;max-width:100%;overflow:hidden;padding:8px;border-left:4px solid var(--slink-warning);border-radius:7px;background:var(--slink-bg-control)}
        .slink-adhd-alert[data-tone="urgent"]{border-left-color:var(--slink-error)}.slink-adhd-alert[data-tone="ready"]{border-left-color:var(--slink-ready)}
        .slink-adhd-alert strong,.slink-adhd-alert span{display:block;overflow-wrap:anywhere}.slink-adhd-alert span{margin-top:2px;color:var(--slink-muted)}
        .slink-adhd-links{display:flex;flex-wrap:wrap;gap:5px;width:100%;min-width:0;max-width:100%;margin-top:7px}.slink-adhd-links a,.slink-adhd-links button{display:inline-flex;align-items:center;justify-content:center;min-height:28px;padding:4px 8px;border:1px solid var(--slink-border);border-radius:6px;background:var(--slink-bg);color:var(--slink-text);box-shadow:inset 0 0 0 1px rgba(255,255,255,.035);font:inherit;text-decoration:none;cursor:pointer}.slink-adhd-links a:hover,.slink-adhd-links button:hover{border-color:var(--slink-accent-alt);background:var(--slink-selected-bg);filter:brightness(1.12)}.slink-adhd-links button:disabled{cursor:not-allowed;opacity:.48;filter:none}
        .slink-adhd-empty{padding:16px;border-radius:7px;background:var(--slink-bg-control);color:var(--slink-muted);text-align:center}
        .slink-adhd-links.adhd-alert-actions{width:100%;max-width:100%;align-self:flex-start;justify-content:flex-start}.slink-adhd-links.adhd-alert-actions>*{flex:0 0 auto}.slink-sound-toggle{display:flex;align-items:center;width:max-content;max-width:100%;flex:0 0 auto;align-self:flex-start;gap:6px;margin:7px 0;color:var(--slink-text);font-size:12px}.slink-sound-toggle input{margin:0}
      `);

      async function claimAlertSound() {
        try { await SLINK.core.messaging.send('audio.flush'); } catch {}
      }

      function alertShareKey(alertId) {
        return `adhd:${String(alertId || '')}`;
      }

      function chatShareArmed(alertId) {
        return SLINK.core.factionChat.isPrimed(alertShareKey(alertId));
      }

      function updateChatButtons(root) {
        root.querySelectorAll('[data-slink-chat-send]').forEach(button => {
          button.disabled = !chatShareArmed(button.dataset.alertId);
          button.title = button.disabled ? 'Copy this listing first to unlock Faction Chat sending' : 'Send the copied listing directly to Faction Chat';
        });
      }

      function updateStatus() {
        if (!current) return;
        SLINK.core.adhd.updateReminderClock(ui.getContentElement(), current.settings);
        ui.setStatus(current?.lastError || (current?.configured ? `API timers updated ${relativeTime(current.fetchedAt)}` : 'Enable Efficiency from the extension dashboard.'), current?.lastError ? 'error' : current?.configured ? 'ready' : 'normal');
      }

      function updateApiUsage(event) {
        if (!current || !event?.detail) return;
        current.tornApiUsage = event.detail;
        const element = ui.getContentElement().querySelector('[data-slink-api-usage]');
        if (element) element.textContent = `${event.detail.count || 0}/${event.detail.limit || 60}`;
      }

      async function runAlertAction(button, action) {
        button.disabled = true;
        try { await action(); }
        catch (error) { ui.setStatus(SLINK.core.format.errorMessage(error), 'error'); }
        finally { if (button.isConnected) button.disabled = false; }
      }

      function render(status) {
        current = status;
        ui.setThemeHealth?.(status?.life?.current, status?.life?.maximum);
        const alerts = SLINK.core.adhd.alertsForView(status?.activeAlerts || [], crimes);
        const selectedAlerts=crimes?alerts.filter(row=>row.id===activeCrime):alerts;
        ui.setAlertCount(crimes?'crimes':'adhd', alerts.length, { group:'efficiency', label:'active Efficiency reminders' });
        updateStatus();
        const root = ui.getContentElement();
        const signature = JSON.stringify({
          alerts, activeCrime, arsonEnabled, city:status?.city, settings:status?.settings, crimeUniques:status?.crimeUniques,
          life:status?.life, configured:status?.configured, lastError:status?.lastError
        });
        if (signature === lastRenderSignature) {
          const summary = root.querySelector('.slink-adhd-summary');
          const cells = summary?.querySelectorAll('strong') || [];
          if (cells[0]) cells[0].textContent = String(alerts.length);
          if (cells[1]) cells[1].textContent = String(status?.city?.bought ?? '—');
          const apiUsage = cells[2];
          if (apiUsage) apiUsage.textContent = `${status?.tornApiUsage?.count || 0}/${status?.tornApiUsage?.limit || 60}`;
          if (!crimes) ui.setBubbleAlert('adhd', alerts.length, 'adhd');
          return;
        }
        lastRenderSignature = signature;
        root.replaceChildren();
        const summary = document.createElement('div');
        summary.className = 'slink-adhd-summary';
        const cells = [
          [alerts.length, 'Active'],
          [status?.city?.bought ?? '—', 'City / 100'],
          [`${status?.tornApiUsage?.count || 0}/${status?.tornApiUsage?.limit || 60}`, 'API / min']
        ];
        for (const [value, label] of cells) {
          const cell = document.createElement('div');
          const strong = document.createElement('strong'); strong.textContent = String(value);
          if (label === 'API / min') strong.dataset.slinkApiUsage = 'true';
          const small = document.createElement('small'); small.textContent = label;
          cell.append(strong, small); summary.append(cell);
        }
        root.append(summary);
        if (crimes) {
          const nav=document.createElement('nav');nav.className='slink-adhd-links';nav.setAttribute('aria-label','Crime tools');
          for(const [id,label] of Object.entries(SLINK.core.adhd.CRIME_TABS)){
            const tab=document.createElement('button');tab.type='button';tab.textContent=label;tab.setAttribute('aria-pressed',String(id===activeCrime));
            if(id===activeCrime)tab.style.fontWeight='700';
            tab.onclick=()=>{activeCrime=id;render(current);};nav.append(tab);
          }
          root.append(nav);
          if(activeCrime==='arsonUnique'&&arson){
            const label=document.createElement('label');const toggle=document.createElement('input');toggle.type='checkbox';toggle.checked=arsonEnabled;
            toggle.onchange=async()=>{toggle.disabled=true;try{await SLINK.core.storage.set('crimes.arson.enabled',toggle.checked);applyArson(toggle.checked);}catch(error){toggle.checked=arsonEnabled;ui.setStatus(SLINK.core.format.errorMessage(error),'error');}finally{toggle.disabled=false;}};
            label.append(toggle,document.createTextNode(' Enable Arson Helper (preview)'));root.append(label);
          }
          const progress = document.createElement('p');
          progress.textContent = 'Manage each crime tracker in Settings.'; root.append(progress);
          for (const row of status?.crimeUniques || []) {
            if (row.id!==activeCrime || status.settings?.enabled?.[row.id] === false) continue;
            const line=document.createElement('p'); line.textContent=`${row.label} · ${row.completed}/${row.total || '—'} uniques`;root.append(line);
          }
        }
        if (!crimes) root.append(SLINK.core.adhd.reminderControls(status.settings || {},
          async action => render(await SLINK.core.messaging.send('adhd.reminder.control', { action })),
          error => ui.setStatus(SLINK.core.format.errorMessage(error), 'error')));
        const soundToggle = document.createElement('label'); soundToggle.className = 'slink-sound-toggle';
        const soundInput = document.createElement('input'); soundInput.type = 'checkbox';
        soundInput.dataset.uiAutosave = 'true';
        const normalizedSettings = SLINK.core.adhd.normalizeSettings(status?.settings || {});
        soundInput.checked = Object.entries(normalizedSettings.soundEnabled).some(([id,value])=>!SLINK.core.adhd.isCrimeAlert(id)&&value);
        soundInput.addEventListener('change', async () => {
          soundInput.disabled = true;
          try {
            const trackingIds = new Set(SLINK.core.adhd.CRIME_UNIQUE_DEFINITIONS.filter(definition => definition.mode === 'tracking').map(definition => definition.id));
            const soundEnabled = Object.fromEntries(Object.keys(normalizedSettings.soundEnabled).filter(id=>!SLINK.core.adhd.isCrimeAlert(id)).map(id => [id, soundInput.checked && !trackingIds.has(id)]));
            render(await SLINK.core.messaging.send('adhd.settings.save', { soundEnabled }));
          } catch (error) { ui.setStatus(SLINK.core.format.errorMessage(error), 'error'); soundInput.disabled = false; }
        });
        soundToggle.append(soundInput, document.createTextNode('Play alert sounds')); if (!crimes) root.append(soundToggle);
        const list = document.createElement('div');
        list.className = 'slink-adhd-list';
        if (!selectedAlerts.length) {
          const empty = document.createElement('div'); empty.className = 'slink-adhd-empty';
          empty.textContent = status?.fetchedAt ? 'You’re caught up. No active API reminders.' : 'Refresh after setup to load your timers.';
          list.append(empty);
        }
        for (const alert of selectedAlerts) {
          const card = document.createElement('article'); card.className = 'slink-adhd-alert'; card.dataset.tone = alert.tone || '';
          const title = document.createElement('strong'); title.textContent = alert.title || 'Reminder';
          const detail = document.createElement('span'); detail.textContent = alert.detail || '';
          const links = document.createElement('div'); links.className = 'slink-adhd-links';
          for (const [label, href] of alert.links || []) {
            const anchor = document.createElement('a'); anchor.href = String(href); anchor.target = status?.settings?.openLinksInNewTab === true ? '_blank' : '_self';
            if (anchor.target === '_blank') anchor.rel = 'noopener noreferrer';
            anchor.textContent = String(label || 'Open'); links.append(anchor);
          }
          if (alert.shareText) {
            const copy = document.createElement('button'); copy.type = 'button'; copy.textContent = 'Copy'; copy.title = 'Copy the compact city-stock listing and HTML link';
            const send = document.createElement('button'); send.type = 'button'; send.textContent = 'Send to Faction'; send.dataset.slinkChatSend = 'true'; send.dataset.alertId = alert.id;
            copy.addEventListener('click', async () => {
              const original = copy.textContent;
              const result = await SLINK.core.factionChat.prime(alert.shareText, { key:alertShareKey(alert.id) });
              copy.textContent = result.label;
              updateChatButtons(root);
              global.setTimeout(() => { if (copy.isConnected) copy.textContent = original; }, 1500);
            });
            send.addEventListener('click', async () => {
              if (!chatShareArmed(alert.id)) { updateChatButtons(root); return; }
              const original = send.textContent;
              send.disabled = true; send.textContent = 'Sending…';
              const result = await SLINK.core.factionChat.sendPrimed({ key:alertShareKey(alert.id) });
              if (!send.isConnected) return;
              send.textContent = result.label;
              updateChatButtons(root);
              global.setTimeout(() => { if (send.isConnected) send.textContent = original; }, 1800);
            });
            links.append(copy, send);
          }
          for (const [label, durationMs] of [['Snooze 5m', 5 * 60_000], ['Snooze 1h', 60 * 60_000], ['Snooze 12h', 12 * 60 * 60_000]]) {
            const snooze = document.createElement('button'); snooze.type = 'button'; snooze.textContent = label;
            snooze.addEventListener('click', () => runAlertAction(snooze, async () => {
              render(await SLINK.core.messaging.send('adhd.alert.snooze', { id:alert.id, durationMs }));
            }));
            links.append(snooze);
          }
          if (alert.id === 'cityItem') {
            const done = document.createElement('button'); done.type = 'button'; done.textContent = 'Bought — hide today';
            done.addEventListener('click', () => runAlertAction(done, async () => render(await SLINK.core.messaging.send('adhd.city.acknowledge'))));
            links.append(done);
          }
          if (alert.id === 'googlePlayPoints') {
            const done = document.createElement('button'); done.type = 'button'; done.textContent = 'Claimed — remind in 7 days';
            done.addEventListener('click', () => runAlertAction(done, async () => render(await SLINK.core.messaging.send('adhd.google-play-points.acknowledge'))));
            links.append(done);
          }
          if (['disposalUnique', 'arsonUnique'].includes(alert.id)) {
            const checked = document.createElement('button'); checked.type = 'button'; checked.textContent = 'Checked today';
            checked.addEventListener('click', () => runAlertAction(checked, async () => render(await SLINK.core.messaging.send('adhd.crime-unique.acknowledge', { id:alert.id }))));
            links.append(checked);
          }
          if (alert.kind === 'faction-onboarding') {
            const verified = document.createElement('button'); verified.type = 'button';
            verified.textContent = alert.viewerIsAdmin ? 'Admin verify' : 'Verified';
            verified.title = alert.viewerIsAdmin && alert.officerVerifiedAt
              ? 'An officer already verified this member; confirm the administrator check'
              : 'Confirm weapon, armor, and Pepper Spray were checked';
            verified.addEventListener('click', () => runAlertAction(verified, async () => {
              await SLINK.core.messaging.send('faction.onboarding.verify', { memberId:alert.memberId });
              await load(false);
            }));
            const dismiss = document.createElement('button'); dismiss.type = 'button'; dismiss.textContent = 'Dismiss';
            dismiss.addEventListener('click', () => runAlertAction(dismiss, async () => {
              await SLINK.core.messaging.send('faction.onboarding.dismiss', { memberId:alert.memberId, joinedAt:alert.joinedAt });
              await load(false);
            }));
            links.append(verified, dismiss);
          }
          card.append(title, detail, links); list.append(card);
        }
        root.append(list);
        updateChatButtons(root);
        if (!crimes) ui.setBubbleAlert('adhd', alerts.length, 'adhd');
      }

      async function load(refreshIfDue = true) {
        try {
          render(await SLINK.core.messaging.send('adhd.status', { refreshIfDue }));
          if (!crimes) await claimAlertSound();
        }
        catch (error) { ui.setStatus(SLINK.core.format.errorMessage(error), 'error'); }
      }

      ui.setActions([
        { id:'refresh', label:'Refresh', onClick:async event => {
          event.currentTarget.disabled = true;
          try {
            render(await SLINK.core.messaging.send('adhd.refresh'));
            if (!crimes) await claimAlertSound();
          }
          catch (error) { ui.setStatus(SLINK.core.format.errorMessage(error), 'error'); }
          finally { event.currentTarget.disabled = false; }
        } },
        { id:'settings', label:'Settings', onClick:async event => {
          event.currentTarget.disabled = true;
          try {
            await SLINK.core.messaging.send('ui.dashboard.open', { page:'alerts', efficiencyView:crimes?'crimes':'alerts' });
          }
          catch (error) { ui.setStatus(`Could not open settings: ${SLINK.core.format.errorMessage(error)}`, 'error'); }
          finally { event.currentTarget.disabled = false; }
        } }
      ]);
      await load(false);
      global.addEventListener('slink:api-usage', updateApiUsage);
      timer = global.setInterval(() => { if (!stopped) void load(!crimes); }, 15_000);
      clockTimer = global.setInterval(() => { if (!stopped) updateStatus(); }, 1_000);
      return {
        stop() {
          stopped = true;
          arson?.dispose();
          if(arson)global.chrome?.storage?.onChanged?.removeListener(arsonStorageChanged);
          if (timer) global.clearInterval(timer);
          if (clockTimer) global.clearInterval(clockTimer);
          global.removeEventListener('slink:api-usage', updateApiUsage);
          if (!crimes) ui.setBubbleAlert('', 0, 'adhd');
          ui.setAlertCount(crimes?'crimes':'adhd', 0);
        },
        status:() => current
      };
    }
  });
})(globalThis);

