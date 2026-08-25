(function registerWar(global) {
  'use strict';

  const SLINK = global.SLINK_EXTENSION;
  const WAR = SLINK.core.war;
  const MODULE_STYLES = `
    .slink-war-subtabs { display:grid; grid-template-columns:repeat(5,minmax(0,1fr)); gap:4px; }
    .slink-war-subtab[aria-selected="true"] { border-color:var(--slink-border); background:var(--slink-accent); }
    .slink-war-summary { display:grid; grid-template-columns:repeat(3,1fr); gap:5px; }
    .slink-war-stat { padding:6px; border-radius:6px; background:var(--slink-bg-raised); text-align:center; }
    .slink-war-stat b,.slink-war-stat span { display:block; }
    .slink-war-stat span { color:var(--slink-muted); font-size:9px; }
    .slink-war-card { display:grid; gap:5px; padding:8px 0; border-top:1px solid var(--slink-border-soft); }
    .slink-war-card:first-child { border-top:0; }
    .slink-war-card-head,.slink-war-meta,.slink-war-card-actions { display:flex; align-items:center; flex-wrap:wrap; gap:5px; }
    .slink-war-card-head a { flex:1; color:var(--slink-text); font-weight:700; text-decoration:none; }
    .slink-war-pill { padding:1px 5px; border-radius:999px; background:var(--slink-bg-raised); color:var(--slink-text); }
    .slink-war-online { color:var(--slink-ready); }
    .slink-war-hospital { color:var(--slink-warning); }
    .slink-war-retal { border-left:3px solid var(--slink-error); padding-left:8px; }
    .slink-war-card-actions a,.slink-war-card-actions button { min-height:27px; padding:4px 7px; border:1px solid var(--slink-border-soft); border-radius:5px; background:var(--slink-bg-control); color:var(--slink-text); text-decoration:none; }
    .slink-war-empty,.slink-war-note,.slink-war-error { padding:9px; border-radius:6px; background:var(--slink-bg-raised); color:var(--slink-muted); }
    .slink-war-error { background:var(--slink-danger-bg); color:var(--slink-error); }
    .slink-war-settings { display:grid; grid-template-columns:1fr 1fr; gap:7px; }
    .slink-war-settings label { display:grid; gap:3px; color:var(--slink-muted); }
    .slink-war-settings .wide,.slink-war-terms,.slink-war-settings-actions { grid-column:1/-1; }
    .slink-war-settings input,.slink-war-settings select { min-width:0; padding:6px; border:1px solid var(--slink-border-soft); border-radius:5px; background:var(--slink-bg-control); color:var(--slink-text); }
    .slink-war-terms { padding:8px; border:1px solid var(--slink-border); border-radius:6px; background:var(--slink-bg-raised); }
    .slink-war-terms summary { cursor:pointer; font-weight:700; }
    .slink-war-terms a { color:var(--slink-link); }
    .slink-war-agree { display:flex !important; grid-template-columns:auto 1fr !important; align-items:start; gap:7px !important; }
    .slink-war-settings-actions { display:flex; flex-wrap:wrap; gap:6px; }
    .window.slink-war-alerting { animation:slinkWarPanelAlert .8s ease-in-out infinite alternate; }
    @keyframes slinkWarPanelAlert { to { border-color:#ff3d3d; box-shadow:0 0 28px rgba(255,0,0,.75); } }
    @media(max-width:420px) { .slink-war-settings{grid-template-columns:1fr}.slink-war-summary{grid-template-columns:repeat(2,1fr)} }
  `;

  function escape(value) {
    return SLINK.core.format.escapeHtml(value);
  }

  SLINK.modules.register({
    id:'war',
    title:'SLINK War',
    defaultShowInTorn:true,
    requiredScopes:['slink.war'],
    matches:url => url.hostname === 'www.torn.com',

    async start(context) {
      let current = null;
      let activeTab = 'targets';
      let stopped = false;
      let busy = false;
      let timer = null;
      let localError = '';
      let targetSort = 'availability';
      let audioContext = null;
      let alertOverlay = null;
      let lastAlertSignature = '';
      const shownAlerts = new Set();
      const fullUi = context.presentation === 'full';

      if (fullUi) {
        context.ui.setTitle('SLINK War');
        context.ui.setModuleStyles(MODULE_STYLES);
      }

      function profileUrl(id) { return `https://www.torn.com/profiles.php?XID=${encodeURIComponent(id)}`; }
      function attackUrl(id) { return `https://www.torn.com/page.php?sid=attack&user2ID=${encodeURIComponent(id)}`; }
      function duration(seconds) { return SLINK.core.format.formatHumanDuration(Math.max(0, seconds)); }

      async function copyCallout(member, button) {
        await navigator.clipboard.writeText(WAR.factionCallout(member));
        const original = button.textContent; button.textContent = 'Copied';
        setTimeout(() => { if (button.isConnected) button.textContent = original; }, 1400);
      }

      function findFactionComposer() {
        const windows = [...document.querySelectorAll('[id^="faction-"]')].filter(node => node.getClientRects().length);
        for (const windowElement of windows) {
          const composer = windowElement.querySelector('[contenteditable="true"],textarea,input[type="text"]');
          if (composer) return composer;
        }
        return null;
      }

      function pasteCallout(member, button) {
        const composer = findFactionComposer();
        if (!composer) {
          localError = 'Open Faction Chat first, then press Paste to faction chat.';
          render(); return;
        }
        const callout = WAR.factionCallout(member);
        composer.focus();
        if ('value' in composer) composer.value = callout;
        else composer.innerHTML = callout;
        composer.dispatchEvent(new InputEvent('input', { bubbles:true, inputType:'insertText', data:callout }));
        const original = button.textContent; button.textContent = 'Pasted';
        setTimeout(() => { if (button.isConnected) button.textContent = original; }, 1400);
      }

      function targetCards() {
        const members = WAR.sortMembers(current?.runtime?.snapshot?.members || [], Date.now(), targetSort);
        if (!members.length) return '<div class="slink-war-empty">No eligible targets in the latest shared snapshot.</div>';
        return members.map(member => {
          const hospitalized = WAR.isHospitalized(member);
          const remaining = WAR.statusSeconds(member);
          const readyAt = hospitalized ? WAR.tctTime(member.statusUntil) : '';
          const claim = (current?.runtime?.snapshot?.claims || []).find(row => Number(row.targetId) === Number(member.id));
          const mine = Number(claim?.claimedById) === Number(current?.session?.userId);
          return `<article class="slink-war-card">
            <div class="slink-war-card-head"><a href="${profileUrl(member.id)}" target="_blank" rel="noopener noreferrer">${escape(member.name)} [${member.id}]</a><span>Lv ${member.level || '?'}</span></div>
            <div class="slink-war-meta"><span class="slink-war-pill ${member.activity === 'Online' ? 'slink-war-online' : ''}">${escape(member.activity)}</span><span class="slink-war-pill ${hospitalized ? 'slink-war-hospital' : ''}">${escape(member.statusState || 'Okay')}${hospitalized ? ` ${duration(remaining)}${readyAt ? ` / ${readyAt} TCT` : ''}` : ''}</span><span class="slink-war-pill">Estimated BS ${Number.isFinite(member.battleStatsEstimate) ? SLINK.core.format.shortNumber(member.battleStatsEstimate) : '?'}</span><span class="slink-war-pill">FF ${Number.isFinite(member.fairFight) ? member.fairFight.toFixed(2) : '?'}</span>${member.statusDescription ? `<span>${escape(member.statusDescription)}</span>` : ''}${member.lastActionRelative ? `<span>${escape(member.lastActionRelative)}</span>` : ''}</div>
            <div class="slink-war-card-actions"><a href="${attackUrl(member.id)}" target="_blank" rel="noopener noreferrer">Attack</a><a href="${profileUrl(member.id)}" target="_blank" rel="noopener noreferrer">Profile</a><button data-war-copy="${member.id}" type="button">Copy</button><button data-war-paste="${member.id}" type="button">Paste to faction chat</button><button data-war-claim="${member.id}" type="button" ${claim && !mine && !current?.session?.officer ? 'disabled' : ''}>${claim ? (mine ? 'Release claim' : `Claimed: ${escape(claim.claimedByName || claim.claimedById)}`) : 'Claim med-out'}</button></div>
          </article>`;
        }).join('');
      }

      function outsideCards() {
        const settings = current?.settings || {};
        const members = WAR.sortMembers(current?.runtime?.outsideTargets || [], Date.now(), 'fairFightAsc');
        const controls = `<div class="slink-war-settings"><label>Minimum FF<input id="slink-war-outside-min" type="number" min="1" max="3" step="0.1" value="${Number(settings.outsideMinFF) || 1}"></label><label>Maximum FF<input id="slink-war-outside-max" type="number" min="1" max="3" step="0.1" value="${Number(settings.outsideMaxFF) || 3}"></label><div class="slink-war-settings-actions"><button id="slink-war-outside-refresh" type="button">Poll up to 50 outside targets</button></div></div>`;
        const message = current?.runtime?.outsideError
          ? `<div class="slink-war-error">${escape(current.runtime.outsideError)}</div>`
          : !members.length ? '<div class="slink-war-empty">Choose a Fair Fight range and poll FFScouter for outside targets.</div>' : '';
        const cards = members.map(member => `<article class="slink-war-card">
          <div class="slink-war-card-head"><a href="${profileUrl(member.id)}" target="_blank" rel="noopener noreferrer">${escape(member.name)} [${member.id}]</a><span>Lv ${member.level || '?'}</span></div>
          <div class="slink-war-meta"><span class="slink-war-pill">${escape(member.activity || 'Unknown')}</span><span class="slink-war-pill">${escape(member.statusState || 'Unknown')}</span><span class="slink-war-pill">Estimated BS ${Number.isFinite(member.battleStatsEstimate) ? SLINK.core.format.shortNumber(member.battleStatsEstimate) : '?'}</span><span class="slink-war-pill">FF ${Number.isFinite(member.fairFight) ? member.fairFight.toFixed(2) : '?'}</span>${member.lastActionRelative ? `<span>${escape(member.lastActionRelative)}</span>` : ''}</div>
          <div class="slink-war-card-actions"><a href="${attackUrl(member.id)}" target="_blank" rel="noopener noreferrer">Attack</a><a href="${profileUrl(member.id)}" target="_blank" rel="noopener noreferrer">Profile</a><button data-war-copy="${member.id}" type="button">Copy</button><button data-war-paste="${member.id}" type="button">Paste to faction chat</button></div>
        </article>`).join('');
        return controls + message + cards;
      }

      function claimCards() {
        const claims = current?.runtime?.snapshot?.claims || [];
        if (!claims.length) return '<div class="slink-war-empty">No med-out targets are currently claimed.</div>';
        return claims.map(claim => {
          const mine = Number(claim.claimedById) === Number(current?.session?.userId);
          return `<article class="slink-war-card">
            <div class="slink-war-card-head"><a href="${profileUrl(claim.targetId)}" target="_blank" rel="noopener noreferrer">${escape(claim.targetName || `Player ${claim.targetId}`)} [${claim.targetId}]</a><span>${duration((Number(claim.expiresAt) - Date.now()) / 1000)}</span></div>
            <div class="slink-war-meta"><span class="slink-war-pill">Claimed by ${escape(claim.claimedByName || claim.claimedById)}</span></div>
            ${mine || current?.session?.officer ? `<div class="slink-war-card-actions"><button data-war-release="${claim.targetId}" type="button">Release claim</button></div>` : ''}
          </article>`;
        }).join('');
      }

      function retalCards() {
        const retals = current?.runtime?.snapshot?.retals || [];
        if (!retals.length) return '<div class="slink-war-empty">No active retaliation alerts.</div>';
        const now = Math.floor(Date.now() / 1000);
        return retals.map(retal => `<article class="slink-war-card slink-war-retal">
          <div class="slink-war-card-head"><a href="${profileUrl(retal.attackerId)}" target="_blank" rel="noopener noreferrer">${escape(retal.attackerName || `Player ${retal.attackerId}`)} [${retal.attackerId}]</a><span>${duration(Number(retal.expiresAt) - now)}</span></div>
          <div class="slink-war-meta"><span class="slink-war-pill">${retal.againstWarOpponent ? 'War opponent' : 'Retal'}</span><span>Hit ${escape(retal.defenderName || retal.defenderId)}</span></div>
          <div class="slink-war-card-actions"><a href="${attackUrl(retal.attackerId)}" target="_blank" rel="noopener noreferrer">Retaliate</a><a href="${profileUrl(retal.attackerId)}" target="_blank" rel="noopener noreferrer">Profile</a></div>
        </article>`).join('');
      }

      function logCards() {
        const logs = current?.runtime?.logs || [];
        if (!logs.length) return '<div class="slink-war-empty">No loss, escape, or online-hit counters yet.</div>';
        return logs.map(row => `<article class="slink-war-card">
          <div class="slink-war-card-head"><strong>${escape(row.attacker_name || row.attacker_id)} → ${escape(row.defender_name || row.defender_id)}</strong><span>${Number(row.event_count) || 0}</span></div>
          <div class="slink-war-meta"><span class="slink-war-pill">${escape(String(row.outcome || '').replace('_', ' '))}</span><span>${new Date(Number(row.last_seen_at) || 0).toLocaleDateString()} ${new Date(Number(row.last_seen_at) || 0).toLocaleTimeString()}</span></div>
        </article>`).join('');
      }

      function settingsHtml() {
        const settings = current?.settings || {};
        const shared = current?.sharedConfig || {};
        const officer = current?.session?.officer === true;
        const accepted = current?.terms?.accepted;
        return `<div class="slink-war-settings">
          <details class="slink-war-terms" ${accepted ? '' : 'open'}><summary>SLINK War data terms${accepted ? ' — accepted' : ''}</summary><p>${escape(current?.terms?.summary || 'Loading current terms...')}</p><a href="${escape(current?.terms?.documentUrl || '#')}" target="_blank" rel="noopener noreferrer">Read the complete terms</a>${accepted ? '<p>Current terms accepted.</p>' : '<label class="slink-war-agree"><input id="slink-war-accept" type="checkbox"><span>I agree to the current SLINK API & Data Terms.</span></label>'}</details>
          <div class="wide slink-war-note">API credentials and permission verification are managed once in the extension dashboard.</div>
          <label>Display mode<select id="slink-war-display"><option value="extension" ${settings.displayMode === 'extension' ? 'selected' : ''}>Extension only</option><option value="torn" ${settings.displayMode === 'torn' ? 'selected' : ''}>Fully in Torn</option><option value="hybrid" ${settings.displayMode === 'hybrid' ? 'selected' : ''}>Hybrid retal alerts</option></select></label>
          <label>Faction War mode<select id="slink-war-mode" ${officer ? '' : 'disabled'}><option value="war" ${(shared.mode || settings.warMode) === 'war' ? 'selected' : ''}>Real war</option><option value="termed" ${(shared.mode || settings.warMode) === 'termed' ? 'selected' : ''}>Termed war</option></select></label>
          <label>Faction idle filter<input id="slink-war-idle" type="number" min="0" max="60" value="${Number(shared.idleMinutes ?? settings.idleMinutes) || 0}" ${officer ? '' : 'disabled'}></label>
          <div class="wide slink-war-note">${officer ? 'War mode and idle filtering apply to everyone in your faction. Other settings remain local.' : `Faction-wide mode is ${shared.mode === 'termed' ? 'Termed war' : 'Real war'}. A slink.war.officer may change it.`}</div>
          <label>Target sort<select id="slink-war-sort"><option value="availability" ${targetSort === 'availability' ? 'selected' : ''}>Availability</option><option value="fairFightDesc" ${targetSort === 'fairFightDesc' ? 'selected' : ''}>FF high to low</option><option value="fairFightAsc" ${targetSort === 'fairFightAsc' ? 'selected' : ''}>FF low to high</option></select></label>
          <div class="slink-war-settings-actions"><button id="slink-war-save" type="button">Save War settings</button><button id="slink-war-clear" type="button">Clear War session</button></div>
        </div>`;
      }

      function render() {
        if (!fullUi) return;
        const snapshot = current?.runtime?.snapshot || {};
        const stats = current?.runtime?.panelStats || {};
        const canViewLogs = current?.session?.canViewLogs === true;
        if (activeTab === 'logs' && !canViewLogs) activeTab = 'targets';
        context.ui.setSubtitle(current?.session?.authenticated ? `${current.session.factionCapable ? 'Faction API' : 'Public API'} / ${current.activeWar?.opponentName || 'No active opponent'}` : 'Setup required');
        context.ui.setStatus(localError || current?.runtime?.lastError || current?.runtime?.status || 'SLINK War ready.', (localError || current?.runtime?.lastError) ? 'error' : (current?.configured ? 'ready' : 'normal'));
        context.ui.setActions([{ label:busy ? 'Refreshing...' : 'Refresh', disabled:busy, onClick:() => runCycle(true) }]);
        const tabs = ['targets', 'outside', 'claims', ...(canViewLogs ? ['logs'] : []), 'settings'];
        const body = activeTab === 'targets' ? targetCards() : activeTab === 'outside' ? outsideCards() : activeTab === 'claims' ? claimCards() : activeTab === 'logs' ? logCards() : settingsHtml();
        const chain = stats.chain?.current ? `${stats.chain.current}${stats.chain.target ? `/${stats.chain.target}` : ''}` : 'None';
        context.ui.setContentHtml(`<div class="slink-war-subtabs">${tabs.map(tab => `<button class="slink-war-subtab" data-war-tab="${tab}" aria-selected="${activeTab === tab}">${tab[0].toUpperCase()}${tab.slice(1)}</button>`).join('')}</div><div class="slink-war-summary"><div class="slink-war-stat"><b>${Number(stats.attacks) || 0}</b><span>Attacks</span></div><div class="slink-war-stat"><b>${Number(stats.warAttacks) || 0}</b><span>War</span></div><div class="slink-war-stat"><b>${Number(stats.mugs) || 0}</b><span>Mugs</span></div><div class="slink-war-stat"><b>${chain}</b><span>Chain</span></div></div>${snapshot.retals?.length ? `<div class="slink-war-note"><strong>Active retals</strong>${retalCards()}</div>` : ''}${localError ? `<div class="slink-war-error">${escape(localError)}</div>` : ''}<div>${body}</div>`);
        bindEvents();
      }

      function bindEvents() {
        const root = context.ui.getContentElement();
        for (const button of root.querySelectorAll('[data-war-tab]')) button.addEventListener('click', () => { activeTab = button.dataset.warTab; render(); });
        const members = new Map([...(current?.runtime?.snapshot?.members || []), ...(current?.runtime?.outsideTargets || [])].map(member => [Number(member.id), member]));
        for (const button of root.querySelectorAll('[data-war-copy]')) button.addEventListener('click', () => void copyCallout(members.get(Number(button.dataset.warCopy)), button).catch(error => { localError=SLINK.core.format.errorMessage(error); render(); }));
        for (const button of root.querySelectorAll('[data-war-paste]')) button.addEventListener('click', () => pasteCallout(members.get(Number(button.dataset.warPaste)), button));
        for (const button of root.querySelectorAll('[data-war-claim]')) button.addEventListener('click', async () => {
          const member = members.get(Number(button.dataset.warClaim));
          const claim = (current?.runtime?.snapshot?.claims || []).find(row => Number(row.targetId) === Number(member?.id));
          try {
            current = await SLINK.core.messaging.send('war.claims.update', { operation:claim ? 'release' : 'claim', targetId:member.id, targetName:member.name });
            localError = ''; render();
          } catch (error) { localError=SLINK.core.format.errorMessage(error); render(); }
        });
        for (const button of root.querySelectorAll('[data-war-release]')) button.addEventListener('click', async () => {
          try { current = await SLINK.core.messaging.send('war.claims.update', { operation:'release', targetId:Number(button.dataset.warRelease) }); localError=''; render(); }
          catch (error) { localError=SLINK.core.format.errorMessage(error); render(); }
        });
        root.querySelector('#slink-war-outside-refresh')?.addEventListener('click', async event => {
          const button = event.currentTarget;
          button.disabled = true;
          try {
            current = await SLINK.core.messaging.send('war.outside.refresh', {
              minFF:root.querySelector('#slink-war-outside-min')?.value,
              maxFF:root.querySelector('#slink-war-outside-max')?.value
            });
            localError = ''; render();
          } catch (error) { localError=SLINK.core.format.errorMessage(error); render(); }
        });
        root.querySelector('#slink-war-clear')?.addEventListener('click', async () => { current = await SLINK.core.messaging.send('war.session.clear'); render(); });
        root.querySelector('#slink-war-save')?.addEventListener('click', async () => {
          try {
            current = await SLINK.core.messaging.send('war.settings.save', {
              displayMode:root.querySelector('#slink-war-display')?.value,
              acceptTerms:root.querySelector('#slink-war-accept')?.checked === true
            });
            if (current?.session?.officer) current = await SLINK.core.messaging.send('war.config.save', {
              mode:root.querySelector('#slink-war-mode')?.value,
              idleMinutes:root.querySelector('#slink-war-idle')?.value
            });
            targetSort = root.querySelector('#slink-war-sort')?.value || targetSort;
            localError = '';
            render();
            void runCycle(true);
          } catch (error) { localError = SLINK.core.format.errorMessage(error); render(); }
        });
      }

      async function dismissedRetals() {
        const values = await SLINK.core.storage.get('war.dismissedRetals.v1', {});
        const now = Math.floor(Date.now() / 1000);
        return Object.fromEntries(Object.entries(values || {}).filter(([, expiresAt]) => Number(expiresAt) > now));
      }

      function unlockAudio() {
        if (!current?.settings?.alertSound) return;
        try {
          const AudioContextClass = global.AudioContext || global.webkitAudioContext;
          if (!AudioContextClass) return;
          if (!audioContext) audioContext = new AudioContextClass();
          if (audioContext.state === 'suspended') void audioContext.resume();
        } catch {}
      }

      function playAlertTone() {
        unlockAudio();
        if (!audioContext || audioContext.state !== 'running') return;
        const oscillator = audioContext.createOscillator();
        const gain = audioContext.createGain();
        oscillator.frequency.value = 620;
        gain.gain.setValueAtTime(0.0001, audioContext.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.18, audioContext.currentTime + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, audioContext.currentTime + 0.45);
        oscillator.connect(gain); gain.connect(audioContext.destination); oscillator.start(); oscillator.stop(audioContext.currentTime + 0.48);
      }

      function setPageAlert(active) {
        if (!current?.settings?.alertPageFlash) active = false;
        if (active && !alertOverlay) {
          alertOverlay = document.createElement('div');
          alertOverlay.id = 'slink-war-page-alert';
          Object.assign(alertOverlay.style, { position:'fixed', inset:'0', border:'12px solid rgba(255,0,0,.9)', boxShadow:'inset 0 0 45px rgba(255,0,0,.7)', zIndex:'2147483647', pointerEvents:'none' });
          document.documentElement.append(alertOverlay);
          alertOverlay.animate([{ opacity:.25 }, { opacity:1 }], { duration:700, direction:'alternate', iterations:Infinity });
        } else if (!active && alertOverlay) {
          alertOverlay.remove(); alertOverlay = null;
        }
      }

      function evaluateAlerts() {
        const settings = current?.settings || {};
        const stats = current?.runtime?.panelStats || {};
        const retals = current?.runtime?.snapshot?.retals || [];
        const chainDanger = settings.chainAlert && Number(stats.chain?.current) >= 50 && Number(stats.chain?.secondsLeft) > 0 && Number(stats.chain.secondsLeft) <= 90;
        const turtleRemaining = Number(stats.turtle?.until) - Math.floor(Date.now() / 1000);
        const turtleDanger = settings.turtleAlert && stats.turtle?.hospitalized && turtleRemaining > 0 && turtleRemaining <= (Number(settings.turtleMinutes) || 5) * 60;
        const active = Boolean(retals.length || chainDanger || turtleDanger);
        const signature = `${retals.map(retal => retal.attackId).join(',')}|${chainDanger}|${turtleDanger}`;
        if (active && signature !== lastAlertSignature && settings.alertSound) playAlertTone();
        lastAlertSignature = active ? signature : '';
        if (fullUi) context.ui.getContentElement()?.closest('.window')?.classList.toggle('slink-war-alerting', active && settings.alertPanelFlash);
        setPageAlert(active);
      }

      async function renderHybridAlerts() {
        if (context.presentation !== 'headless') return;
        const dismissed = await dismissedRetals();
        const currentIds = new Set();
        for (const retal of current?.runtime?.snapshot?.retals || []) {
          const id = String(retal.attackId);
          currentIds.add(id);
          if (dismissed[id] || shownAlerts.has(id)) continue;
          shownAlerts.add(id);
          context.ui.showAlert({
            id:`war-retal-${id}`,
            title:'SLINK Retaliation',
            subtitle:`${retal.attackerName || `Player ${retal.attackerId}`} / ${duration(Number(retal.expiresAt) - Math.floor(Date.now() / 1000))}`,
            contentHtml:`<div><strong>${escape(retal.attackerName || `Player ${retal.attackerId}`)} [${retal.attackerId}]</strong></div><div>${retal.againstWarOpponent ? 'Current war opponent' : 'Retaliation available'}</div>`,
            actions:[{ label:'Retaliate', href:attackUrl(retal.attackerId) }, { label:'Profile', href:profileUrl(retal.attackerId) }],
            onDismiss:async () => {
              dismissed[id] = Number(retal.expiresAt) || Math.floor(Date.now() / 1000) + 300;
              await SLINK.core.storage.set('war.dismissedRetals.v1', dismissed);
            }
          });
        }
        for (const id of [...shownAlerts]) {
          if (!currentIds.has(id)) {
            context.ui.dismissAlert(`war-retal-${id}`);
            shownAlerts.delete(id);
          }
        }
      }

      async function runCycle(force = false) {
        if (busy || stopped) return;
        busy = true;
        if (fullUi) render();
        try {
          current = await SLINK.core.messaging.send('war.status');
          current = await SLINK.core.messaging.send('war.cycle.prepare');
          localError = '';
          await renderHybridAlerts();
          evaluateAlerts();
        } catch (error) {
          localError = SLINK.core.format.errorMessage(error);
          if (!force && /terms|API key|permission/i.test(localError)) localError = '';
        } finally {
          busy = false;
          if (fullUi) render();
          schedule();
        }
      }

      function schedule() {
        if (stopped) return;
        clearTimeout(timer);
        timer = setTimeout(() => void runCycle(false), 10_000);
      }

      current = await SLINK.core.messaging.send('war.status');
      document.addEventListener('pointerdown', unlockAudio, { passive:true });
      if (fullUi && !current.configured) activeTab = 'settings';
      render();
      void runCycle(false);
      return { stop() { stopped = true; clearTimeout(timer); setPageAlert(false); document.removeEventListener('pointerdown', unlockAudio); for (const id of shownAlerts) context.ui.dismissAlert(`war-retal-${id}`); } };
    }
  });
})(globalThis);
