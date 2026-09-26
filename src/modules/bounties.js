(function registerBounties(global) {
  'use strict';

  const SLINK = global.SLINK_EXTENSION;
  const ACTIVE_HEARTBEAT_MS = 60_000;
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
    .bounty-actions a { padding:4px 7px; border:1px solid rgba(255,255,255,.15); border-radius:5px; background:#2b3745; color:#fff; text-decoration:none; }
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

  function pageTarget() {
    const url = new URL(global.location.href);
    const attack = url.searchParams.get('sid') === 'attack';
    const profile = url.pathname.toLowerCase().includes('profiles.php');
    const id = Number(attack ? url.searchParams.get('user2ID') : profile ? url.searchParams.get('XID') : 0);
    return Number.isInteger(id) && id > 0 ? { id, source:attack ? 'attack' : 'profile' } : null;
  }

  SLINK.modules.register({
    id:'bounties',
    title:'SLINK Bounties',
    shortTitle:'Bounties',
    group:'combat',
    groupTitle:'Combat',
    defaultShowInTorn:true,
    requiredScopes:[],
    matches:url => url.hostname === 'www.torn.com',

    async start(context) {
      let current = null;
      let busy = false;
      let settingsOpen = false;
      let stopped = false;
      let localError = '';
      let scanTimer = null;
      let heartbeatTimer = null;
      let countdownTimer = null;
      let visibilityObserver = null;
      let statusObserver = null;
      let lastObserved = '';

      context.ui.setTitle('SLINK Bounties');
      context.ui.setModuleStyles(MODULE_STYLES);

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
          <label class="wide">Torn public API key<input id="bounty-torn-key" type="password" autocomplete="off" placeholder="${settings.hasTornKey ? `Saved via ${escape(settings.tornKeySource)} — blank keeps it` : 'Required; blank uses Leveling key'}"></label>
          <label class="wide">FFScouter key<input id="bounty-ff-key" type="password" autocomplete="off" placeholder="${settings.hasFfKey ? `Saved via ${escape(settings.ffKeySource)} — blank keeps it` : 'Blank uses Leveling key'}"></label>
          <div class="bounty-settings-actions"><button id="bounty-save" type="button">Save</button><button id="bounty-restart" type="button">Restart scan</button></div>
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
        if (!candidates?.length) return `<div class="bounty-empty">${busy ? 'Scanning and estimating targets…' : 'No targets match the current filters.'}</div>`;
        return candidates.map(target => {
          const profile = `https://www.torn.com/profiles.php?XID=${encodeURIComponent(target.id)}`;
          const attack = `https://www.torn.com/page.php?sid=attack&user2ID=${encodeURIComponent(target.id)}`;
          return `<article class="bounty-target">
            <div class="bounty-head"><a href="${profile}">${escape(target.name)} [${target.id}]</a><span class="bounty-reward">$${Number(target.highestReward).toLocaleString()}</span></div>
            <div class="bounty-meta">
              <span class="bounty-badge" data-state="${escape(target.status?.state || 'Unknown')}">${statusText(target)}</span>
              <span class="bounty-badge">Lv ${Number(target.level) || '?'}</span>
              <span class="bounty-badge">FF ${target.fairFight ? Number(target.fairFight).toFixed(2) : '?'}</span>
              <span class="bounty-badge">BS ${target.bsEstimate ? escape(SLINK.core.format.shortNumber(target.bsEstimate)) : '?'}</span>
              ${Number(target.highestQuantity) > 1 ? `<span class="bounty-badge">×${Number(target.highestQuantity)}</span>` : ''}
            </div>
            <div class="bounty-actions"><a href="${profile}">Profile</a><a href="${attack}">Attack</a></div>
          </article>`;
        }).join('');
      }

      function render() {
        const runtime = current?.runtime || {};
        context.ui.setSubtitle(current?.settings?.enabled ? 'Live bounty API crawl' : 'Disabled');
        context.ui.setStatus(localError || runtime.lastError || runtime.cycleStatus || 'Bounty Tracker ready.', localError || runtime.lastError ? 'error' : current?.configured ? 'ready' : 'normal');
        context.ui.setActions([
          { id:'refresh', label:busy ? 'Working…' : 'Refresh', disabled:busy, onClick:() => runScan(true) },
          { id:'settings', label:settingsOpen ? 'Close settings' : 'Settings', onClick:() => { settingsOpen = !settingsOpen; render(); } }
        ]);
        context.ui.setContentHtml(`
          <div class="bounty-summary">
            <div class="bounty-stat"><b>${Number(runtime.scannedRows || 0).toLocaleString()}</b><span>Rows scanned</span></div>
            <div class="bounty-stat"><b>${Number(runtime.uniqueTargets || 0).toLocaleString()}</b><span>Unique targets</span></div>
            <div class="bounty-stat"><b>${Number(runtime.candidateCount || 0).toLocaleString()}</b><span>Matches</span></div>
          </div>
          ${!current?.settings?.enabled ? '<div class="bounty-note">Enable the tracker to begin. It runs while this tab is open and for five minutes after you leave it.</div>' : ''}
          ${!current?.configured && current?.settings?.enabled ? '<div class="bounty-note">Add a Torn public key and FFScouter key. Existing Leveling keys are reused automatically.</div>' : ''}
          ${(localError || runtime.lastError) ? `<div class="bounty-error">${escape(localError || runtime.lastError)}</div>` : ''}
          ${settingsOpen ? settingsHtml() : ''}
          <div>${candidatesHtml(runtime.candidates || [])}</div>
        `);
        bindEvents();
        updateCountdowns();
      }

      function bindEvents() {
        const root = context.ui.getContentElement();
        root.querySelector('#bounty-save')?.addEventListener('click', async () => {
          const payload = {
            enabled:root.querySelector('#bounty-enabled')?.checked === true,
            minimumReward:root.querySelector('#bounty-minimum')?.value,
            scanFullList:root.querySelector('#bounty-full-list')?.checked === true,
            minFF:root.querySelector('#bounty-min-ff')?.value,
            maxFF:root.querySelector('#bounty-max-ff')?.value,
            maxBattleStats:root.querySelector('#bounty-max-bs')?.value,
            statusFilter:root.querySelector('#bounty-status-filter')?.value,
            includeUnknownEstimates:root.querySelector('#bounty-unknown')?.checked === true,
            includeAbroad:root.querySelector('#bounty-abroad')?.checked === true,
            tornCallsPerMinute:root.querySelector('#bounty-torn-rate')?.value,
            ffBatchesPerMinute:root.querySelector('#bounty-ff-rate')?.value,
            tornKey:root.querySelector('#bounty-torn-key')?.value || '',
            ffKey:root.querySelector('#bounty-ff-key')?.value || ''
          };
          busy = true; localError = ''; render();
          try {
            current = await SLINK.core.messaging.send('bounties.settings.save', payload);
            settingsOpen = false;
          } catch (error) { localError = SLINK.core.format.errorMessage(error); }
          finally { busy = false; render(); syncActivity(); }
        });
        root.querySelector('#bounty-restart')?.addEventListener('click', async () => {
          try { current = await SLINK.core.messaging.send('bounties.scan.reset'); render(); void runScan(true); }
          catch (error) { localError = SLINK.core.format.errorMessage(error); render(); }
        });
      }

      function updateCountdowns() {
        for (const node of context.ui.getContentElement().querySelectorAll('[data-bounty-until]')) {
          const seconds = Math.ceil(Number(node.dataset.bountyUntil) - Date.now() / 1000);
          node.textContent = seconds > 0 ? `Hospital · ${SLINK.core.format.formatHumanDuration(seconds)}` : 'Presumed Okay';
        }
      }

      async function refreshStatus() {
        current = await SLINK.core.messaging.send('bounties.status');
        if (!current.settings.enabled) settingsOpen = true;
        render();
      }

      async function touch() {
        try { current = await SLINK.core.messaging.send('bounties.activity.touch'); }
        catch {}
      }

      function syncActivity() {
        clearInterval(heartbeatTimer);
        heartbeatTimer = null;
        if (!moduleVisible() || !current?.settings?.enabled) return;
        void touch();
        heartbeatTimer = setInterval(() => void touch(), ACTIVE_HEARTBEAT_MS);
        void runScan(false);
      }

      function scheduleScan(delay = 1_000) {
        clearTimeout(scanTimer);
        scanTimer = setTimeout(() => void runScan(false), delay);
      }

      async function runScan(force) {
        if (busy || stopped || !current?.settings?.enabled) return;
        if (force && moduleVisible()) await touch();
        if (!current?.active && !moduleVisible()) return;
        busy = true; localError = ''; render();
        try { current = await SLINK.core.messaging.send('bounties.scan.batch', { forceRestart:force === true && current?.runtime?.completed === true }); }
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

      async function observeCurrentPage() {
        const target = pageTarget();
        if (!target || !current?.settings?.enabled) return;
        const selectors = target.source === 'profile'
          ? ['[class*="status"]', '[class*="basic-information"]', '[data-testid*="status"]']
          : ['[class*="dialog"]', '[class*="status"]', '[class*="result"]', '[data-testid*="status"]'];
        for (const node of document.querySelectorAll(selectors.join(','))) {
          const text = String(node.innerText || node.textContent || '').trim();
          const state = detectState(text);
          if (!state) continue;
          const remaining = parseRemainingMs(text);
          const signature = `${target.id}:${target.source}:${state}:${Math.floor(remaining / 1000)}`;
          if (signature === lastObserved) return;
          lastObserved = signature;
          try {
            current = await SLINK.core.messaging.send('bounties.status.observe', {
              targetId:target.id,
              state,
              until:remaining > 0 ? Math.floor((Date.now() + remaining) / 1000) : 0,
              description:text.slice(0, 500),
              source:target.source
            });
            render();
          } catch {}
          return;
        }
      }

      await refreshStatus();
      const view = context.ui.getContentElement()?.closest('.module-view');
      if (view) {
        visibilityObserver = new MutationObserver(syncActivity);
        visibilityObserver.observe(view, { attributes:true, attributeFilter:['hidden'] });
      }
      statusObserver = new MutationObserver(() => void observeCurrentPage());
      statusObserver.observe(document.documentElement, { childList:true, subtree:true });
      countdownTimer = setInterval(updateCountdowns, 1_000);
      syncActivity();
      void observeCurrentPage();

      return Object.freeze({
        stop() {
          stopped = true;
          clearTimeout(scanTimer);
          clearInterval(heartbeatTimer);
          clearInterval(countdownTimer);
          visibilityObserver?.disconnect();
          statusObserver?.disconnect();
        }
      });
    }
  });
})(globalThis);

