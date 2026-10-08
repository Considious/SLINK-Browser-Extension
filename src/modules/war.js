(function registerWar(global) {
  'use strict';

  const SLINK = global.SLINK_EXTENSION;
  const WAR = SLINK.core.war;
  const MODULE_STYLES = `
    .slink-war-subtabs { display:grid; grid-template-columns:repeat(auto-fit,minmax(58px,1fr)); gap:4px; }
    .slink-war-subtab { display:flex; align-items:center; justify-content:center; gap:5px; }
    .slink-war-subtab[aria-selected="true"] { border-color:var(--slink-border); background:var(--slink-accent); }
    .slink-war-summary { display:grid; grid-template-columns:repeat(4,1fr); gap:5px; }
    .slink-war-stat { padding:6px; border-radius:6px; background:var(--slink-bg-raised); text-align:center; }
    .slink-war-stat b,.slink-war-stat span { display:block; }
    .slink-war-stat span { color:var(--slink-muted); font-size:9px; }
    .slink-war-card { display:grid; gap:7px; padding:9px; border:1px solid var(--slink-border-soft); border-radius:8px; background:var(--slink-bg-raised); box-shadow:0 2px 8px var(--slink-shadow); }
    .slink-war-card + .slink-war-card { margin-top:7px; }
    .slink-war-card-head,.slink-war-meta,.slink-war-card-actions { display:flex; align-items:center; flex-wrap:wrap; gap:5px; }
    .slink-war-card-head { padding-bottom:6px; border-bottom:1px solid var(--slink-border-soft); }
    .slink-war-card-head a { flex:1; color:var(--slink-text); font-weight:800; text-decoration:none; }
    .slink-war-meta { align-items:stretch; }
    .slink-war-pill { display:inline-flex; align-items:center; min-height:21px; padding:2px 6px; border:1px solid var(--slink-border-soft); border-radius:999px; background:var(--slink-bg-control); color:var(--slink-text); }
    .slink-war-context { flex-basis:100%; padding-top:1px; color:var(--slink-muted); }
    .slink-war-online { color:var(--slink-ready); }
    .slink-war-hospital { color:var(--slink-warning); }
    .slink-war-retal { position:relative; padding-right:34px; border-left:3px solid var(--slink-error); padding-left:8px; }
    .slink-war-retal-dismiss { position:absolute; right:7px; top:7px; display:grid; place-items:center; width:24px; min-height:24px !important; padding:0 !important; border-color:var(--slink-error) !important; border-radius:50% !important; color:var(--slink-error) !important; font-weight:900; }
    .slink-war-retal-report { display:grid; grid-template-columns:82px minmax(0,1fr); gap:3px 7px; }
    .slink-war-retal-report span:nth-child(odd) { color:var(--slink-muted); }
    .slink-war-log-person { border-top:1px solid var(--slink-border-soft); }
    .slink-war-log-person summary { display:flex; align-items:center; justify-content:space-between; gap:8px; padding:8px 2px; cursor:pointer; }
    .slink-war-log-events { display:grid; gap:6px; padding:0 0 8px 10px; }
    .slink-war-log-event { padding:7px; border-left:2px solid var(--slink-border); background:var(--slink-bg-raised); }
    .slink-war-log-event a { color:var(--slink-link); text-decoration:none; }
    .slink-war-card-actions { padding-top:2px; }
    .slink-war-card-actions a,.slink-war-card-actions button { min-height:27px; padding:4px 7px; border:1px solid var(--slink-border-soft); border-radius:5px; background:var(--slink-bg-control); color:var(--slink-text); text-decoration:none; }
    .slink-war-card-actions .slink-war-retal-attack { border-color:var(--slink-error); background:var(--slink-danger-bg); color:var(--slink-error); font-weight:800; }
    .slink-war-card-actions .slink-war-chat-authorized { border-color:var(--slink-ready); color:var(--slink-ready); box-shadow:0 0 8px color-mix(in srgb,var(--slink-ready) 35%,transparent); }
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
    .slink-war-report { display:flex; align-items:center; justify-content:space-between; gap:6px; margin-top:6px; }
    .slink-war-armory { display:grid; gap:7px; }
    .slink-war-armory-controls,.slink-war-armory-actions { display:flex; flex-wrap:wrap; align-items:end; gap:6px; }
    .slink-war-armory-controls label { display:grid; flex:1 1 170px; gap:3px; color:var(--slink-muted); }
    .slink-war-armory-controls select,.slink-war-armory-search { min-width:0; padding:6px; border:1px solid var(--slink-border-soft); border-radius:5px; background:var(--slink-bg-control); color:var(--slink-text); }
    .slink-war-armory-manager { padding:7px; border:1px solid var(--slink-border-soft); border-radius:6px; }
    .slink-war-armory-manager summary { cursor:pointer; font-weight:700; }
    .slink-war-armory-manager-actions { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:4px; margin:6px 0; }
    .slink-war-armory-manager-actions button { min-height:28px; padding:4px 3px; }
    .slink-war-armory-members { display:grid; gap:3px; max-height:220px; overflow:auto; padding:4px; border:1px solid var(--slink-border-soft); border-radius:6px; }
    .slink-war-armory-member { display:grid; grid-template-columns:auto 1fr; align-items:center; gap:7px; padding:5px; background:var(--slink-bg-raised); }
    .slink-war-armory-member small { display:block; color:var(--slink-muted); }
    .slink-war-armory-status[data-state="success"] { color:var(--slink-ready); }
    .slink-war-armory-status[data-state="error"] { color:var(--slink-error); }
    .slink-war-card[data-inside-blocked="true"] { outline:3px solid var(--slink-error); box-shadow:0 0 18px color-mix(in srgb,var(--slink-error) 60%,transparent); }
    .slink-war-inside-disabled { color:var(--slink-error); font-weight:800; }
    .window.slink-war-alerting { animation:slinkWarPanelAlert .8s ease-in-out infinite alternate; }
    @keyframes slinkWarPanelAlert { to { border-color:#ff3d3d; box-shadow:0 0 28px rgba(255,0,0,.75); } }
    @media(max-width:420px) { .slink-war-settings{grid-template-columns:1fr}.slink-war-summary{grid-template-columns:repeat(2,1fr)} }
  `;

  const PAGE_STYLES = `
    a.slink-profile-inside-gate { position:relative; border-radius:8px; outline:4px solid #ff3434 !important; background:#5d1010 !important; box-shadow:0 0 18px rgba(255,0,0,.85) !important; }
    a.slink-profile-inside-gate[data-slink-inside-mode="warn"] { outline-color:#ff9f1c !important; box-shadow:0 0 18px rgba(255,159,28,.8) !important; }
    .slink-profile-inside-message { display:inline-flex; align-items:center; margin:4px 0 4px 8px; padding:4px 7px; border:2px solid #ff3434; border-radius:5px; background:#4c0d0d; color:#fff; font:800 11px Arial,sans-serif; }
  `;
  function escape(value) {
    return SLINK.core.format.escapeHtml(value);
  }

  SLINK.modules.register({
    id:'war',
    title:'SLINK War',
    shortTitle:'War',
    group:'combat',
    groupTitle:'Combat',
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
      let targetFilters = { minFF:1, maxFF:3, status:'all', abroad:'all', location:'all' };
      let alertOverlay = null;
      let lastAlertSignature = '';
      let armoryMode = 'ranked-all';
      let armoryWhitelist = new Set();
      let armoryMembers = [];
      let armoryMembersSavedAt = 0;
      let armoryRankOrder = [];
      let armorySearch = '';
      let armoryWhitelistOpen = false;
      let armoryRankCaptureTimers = [];
      let armoryStatus = 'Ready. Retrieval only runs after you press Retrieve Next.';
      let armoryState = 'normal';
      let armoryBusy = false;
      let armoryTimestampValue = new Date().toISOString().slice(0, 16);
      let armoryObserver = null;
      let pageStyleElement = null;
      let insideGateElement = null;
      let insideUnlockedTarget = 0;
      let insideUnlockedUntil = 0;
      let dismissedRetalMap = {};
      const reportedMugNodes = new WeakSet();
      const recentMugResults = new Map();
      let attackMugScanTimer = null;
      let leader = false;
      let leaderTimer = null;
      const leaderClientId = `war:${global.crypto?.randomUUID?.() || `${Date.now()}:${Math.random()}`}`;
      const shownAlerts = new Set();
      const shownRequestAlerts = new Set();
      const fullUi = context.presentation === 'full';

      if (fullUi) {
        context.ui.setTitle('SLINK War');
        context.ui.setModuleStyles(MODULE_STYLES);
      }

      function profileUrl(id) { return `https://www.torn.com/profiles.php?XID=${encodeURIComponent(id)}`; }
      function attackUrl(id) { return `https://www.torn.com/page.php?sid=attack&user2ID=${encodeURIComponent(id)}`; }
      function duration(seconds) { return SLINK.core.format.formatHumanDuration(Math.max(0, seconds)); }
      function money(value) { return `$${Math.max(0, Number(value) || 0).toLocaleString('en-US', { maximumFractionDigits:0 })}`; }
      function pageIsFocused() { return document.visibilityState === 'visible' && document.hasFocus(); }

      function ensurePageStyles() {
        if (pageStyleElement?.isConnected) return pageStyleElement;
        pageStyleElement = document.createElement('style');
        pageStyleElement.id = 'slink-war-page-styles';
        pageStyleElement.textContent = PAGE_STYLES;
        document.head.append(pageStyleElement);
        return pageStyleElement;
      }

      const INSIDE_WINDOWS = Object.freeze([[0, 100], [200, 250], [450, 500], [950, 1000], [2350, 2500], [4850, 5000], [9900, 10000]]);

      function activeInsideWindow() {
        if (current?.activeWar?.phase !== 'active' || current?.sharedConfig?.mode !== 'termed') return null;
        const chain = current?.runtime?.panelStats?.chain;
        if (!chain) return null;
        const count = Math.max(0, Number(chain.current) || 0);
        const range = INSIDE_WINDOWS.find(([minimum, maximum]) => count >= minimum && count <= maximum);
        return range ? { count, minimum:range[0], maximum:range[1] } : null;
      }

      function opponentMemberIds() {
        const snapshot = current?.runtime?.snapshot || {};
        return new Set([...(snapshot.opponentMemberIds || []), ...(snapshot.members || []).map(member => member.id)].map(Number).filter(Boolean));
      }

      function insideGate(targetId) {
        const blockMode = ['off', 'warn', 'block'].includes(current?.sharedConfig?.insideBlockMode) ? current.sharedConfig.insideBlockMode : 'warn';
        const range = activeInsideWindow();
        const id = Number(targetId);
        return {
          active:Boolean(range && blockMode !== 'off' && opponentMemberIds().has(id) && !(insideUnlockedTarget === id && insideUnlockedUntil > Date.now())),
          mode:blockMode,
          range,
          targetId:id
        };
      }

      function insideGateMessage(gate) {
        return `INSIDE HITS DISABLED — chain ${gate.range?.count ?? '?'} is inside the ${gate.range?.minimum ?? '?'}–${gate.range?.maximum ?? '?'} major bonus window.`;
      }

      function clearAttackPageGate() {
        insideGateElement?.remove();
        insideGateElement = null;
      }

      function onAttackPage() {
        const url = new URL(location.href);
        return /\/page\.php$/i.test(url.pathname) && String(url.searchParams.get('sid') || '').toLowerCase() === 'attack';
      }

      function attackPageTargetId() {
        if (!onAttackPage()) return 0;
        return Number(new URL(location.href).searchParams.get('user2ID')) || 0;
      }

      async function reportMugResultNode(node) {
        if (!node || reportedMugNodes.has(node)) return;
        const result = WAR.parseMugResultText(node.textContent);
        if (!result) return;
        reportedMugNodes.add(node);
        const victimId = attackPageTargetId();
        const fingerprint = `${victimId || result.victimName.toLocaleLowerCase()}:${result.amount}`;
        const now = Date.now();
        for (const [key, seenAt] of recentMugResults) if (now - seenAt > 5 * 60_000) recentMugResults.delete(key);
        if (recentMugResults.has(fingerprint)) return;
        recentMugResults.set(fingerprint, now);
        try {
          current = await SLINK.core.messaging.send('war.mug.report', {
            victimId,
            victimName:result.victimName,
            amount:result.amount
          });
          render();
        } catch (error) {
          // One attack-result node gets one reporting attempt. Torn mutates the
          // result frame heavily; retrying on every mutation can lock the page.
          console.debug('[SLINK] Mug result report paused:', SLINK.core.format.errorMessage(error));
        }
      }

      function scanAttackMugResults() {
        if (!onAttackPage() || attackMugScanTimer) return;
        attackMugScanTimer = setTimeout(() => {
          attackMugScanTimer = null;
          if (!onAttackPage()) return;
          const nodes = new Set(document.querySelectorAll('div[class*="dialog___"] div[class*="title___"],div[class*="green___"] div[class*="title___"]'));
          for (const node of nodes) void reportMugResultNode(node);
        }, 120);
      }

      function profileAttackButton() {
        if (!/\/profiles\.php$/i.test(location.pathname)) return null;
        return document.querySelector('a.profile-button-attack[href*="sid=attack"][href*="user2ID="]');
      }

      function profileAttackTarget(button) {
        try { return Number(new URL(button?.href || '', location.href).searchParams.get('user2ID')) || 0; }
        catch { return 0; }
      }

      function clearProfileAttackGate() {
        for (const button of document.querySelectorAll('a.slink-profile-inside-gate')) {
          button.classList.remove('slink-profile-inside-gate');
          button.removeAttribute('data-slink-inside-mode');
          button.removeAttribute('aria-disabled');
          button.removeAttribute('title');
        }
        document.querySelectorAll('.slink-profile-inside-message').forEach(node => node.remove());
      }

      function renderProfileAttackGate() {
        clearProfileAttackGate();
        const button = profileAttackButton();
        const gate = insideGate(profileAttackTarget(button));
        if (!button || !gate.active) return;
        ensurePageStyles();
        button.classList.add('slink-profile-inside-gate');
        button.dataset.slinkInsideMode = gate.mode;
        if (gate.mode === 'block') button.setAttribute('aria-disabled', 'true');
        button.title = gate.mode === 'block'
          ? insideGateMessage(gate)
          : `${insideGateMessage(gate)} Click for an explicit override warning.`;
        const warning = document.createElement('span');
        warning.className = 'slink-profile-inside-message';
        warning.textContent = gate.mode === 'block' ? 'INSIDES DISABLED' : 'INSIDE HIT — WARNING REQUIRED';
        button.insertAdjacentElement('afterend', warning);
      }

      function handleProfileAttack(event) {
        const button = event.target.closest?.('a.profile-button-attack[href*="sid=attack"][href*="user2ID="]');
        if (!button) return;
        const targetId = profileAttackTarget(button);
        const gate = insideGate(targetId);
        if (!gate.active) return;
        void handleAttackLink(event, targetId).then(renderProfileAttackGate);
      }

      async function unlockInsideTarget(targetId) {
        insideUnlockedTarget = Number(targetId);
        insideUnlockedUntil = Date.now() + 2 * 60_000;
        await SLINK.core.storage.set('war.insideUnlock.v1', { targetId:insideUnlockedTarget, expiresAt:insideUnlockedUntil });
      }

      function renderAttackPageGate() {
        const params = new URL(location.href).searchParams;
        if (params.get('sid') !== 'attack') return clearAttackPageGate();
        const targetId = Number(params.get('user2ID')) || 0;
        const gate = insideGate(targetId);
        if (!gate.active) return clearAttackPageGate();
        if (!insideGateElement) {
          insideGateElement = document.createElement('div');
          insideGateElement.id = 'slink-inside-hit-gate';
          Object.assign(insideGateElement.style, { position:'fixed', inset:'0', zIndex:'2147483646', background:'rgba(55,0,0,.28)', boxShadow:'inset 0 0 0 10px #f22929,inset 0 0 60px rgba(255,0,0,.85)', display:'grid', placeItems:'start center', paddingTop:'90px', pointerEvents:'auto' });
          document.documentElement.append(insideGateElement);
        }
        const allow = gate.mode === 'warn' ? '<button id="slink-inside-ack" type="button">I understand — unlock this target</button>' : '';
        insideGateElement.innerHTML = `<div style="max-width:620px;margin:12px;padding:18px;border:3px solid #ff3434;border-radius:10px;background:#170607;color:#fff;box-shadow:0 0 30px #f00;text-align:center"><h2 style="margin:0 0 8px;color:#ff4949">NO INSIDE HITS DURING MAJOR BONUS WINDOWS</h2><p>${escape(insideGateMessage(gate))}</p><p>${gate.mode === 'block' ? 'Faction officers have enabled a hard block. The attack page cannot be used for this target during this window.' : 'You must explicitly acknowledge the warning before Torn controls are uncovered.'}</p>${allow}</div>`;
        insideGateElement.querySelector('#slink-inside-ack')?.addEventListener('click', async () => {
          await unlockInsideTarget(targetId);
          clearAttackPageGate();
        }, { once:true });
      }

      function renderInsideGateSurfaces() {
        renderAttackPageGate();
        renderProfileAttackGate();
      }

      function retalDismissKey(retal) {
        return `user:${Number(retal?.attackerId) || String(retal?.attackId || '')}`;
      }

      function visibleRetals() {
        const now = Math.floor(Date.now() / 1000);
        const termedOpponent = current?.sharedConfig?.mode === 'termed' ? Number(current?.activeWar?.opponentFactionId) || 0 : 0;
        const termedMembers = termedOpponent ? opponentMemberIds() : new Set();
        return (current?.runtime?.snapshot?.retals || []).filter(retal => {
          const expiresAt = Number(retal.expiresAt) || now + 300;
          const belongsToTermedOpponent = termedOpponent > 0 && (Number(retal.attackerFactionId) === termedOpponent || termedMembers.has(Number(retal.attackerId)));
          return expiresAt > now && !belongsToTermedOpponent && !dismissedRetalMap[retalDismissKey(retal)] && !dismissedRetalMap[String(retal.attackId)];
        });
      }

      async function dismissRetal(retal) {
        if (!retal) return;
        dismissedRetalMap[retalDismissKey(retal)] = Number(retal.expiresAt) || Math.floor(Date.now() / 1000) + 300;
        dismissedRetalMap = Object.fromEntries(Object.entries(dismissedRetalMap).filter(([, until]) => Number(until) > Math.floor(Date.now() / 1000)));
        await SLINK.core.storage.set('war.dismissedRetals.v1', dismissedRetalMap);
        const id = String(retal.attackId);
        context.ui.dismissAlert(`war-retal-${id}`);
        shownAlerts.delete(id);
        evaluateAlerts();
        render();
      }

      async function handleAttackLink(event, targetId) {
        const gate = insideGate(targetId);
        if (!gate.active) return true;
        event.preventDefault();
        event.stopPropagation();
        if (gate.mode === 'warn' && global.confirm(`${insideGateMessage(gate)}\n\nOpen this inside target anyway?`)) {
          await unlockInsideTarget(targetId);
          global.open(attackUrl(targetId), '_blank', 'noopener');
        } else {
          localError = insideGateMessage(gate);
          render();
        }
        return false;
      }

      function activeArmoryTab() {
        return [document.querySelector('[id="tab=armoury&sub=weapons"]'), document.querySelector('[id="tab=armoury&sub=armour"]')]
          .filter(Boolean)
          .find(tab => tab.getAttribute('aria-hidden') !== 'true' && getComputedStyle(tab).display !== 'none') || null;
      }

      function armoryTabKind(tab) {
        if (tab?.id.includes('sub=weapons')) return 'weapons';
        if (tab?.id.includes('sub=armour')) return 'armour';
        return null;
      }

      function armoryBorrower(row) {
        const link = row.querySelector('.loaned a[href*="XID="]');
        const match = link?.getAttribute('href')?.match(/[?&]XID=(\d+)/i);
        return match ? { id:match[1], name:link.textContent.trim() || match[1] } : null;
      }

      function armoryEligibility(row, kind) {
        const borrower = armoryBorrower(row);
        if (!borrower || armoryWhitelist.has(borrower.id)) return null;
        if (!row.querySelector('.item-action [data-role="retrieve"].active')) return null;
        const image = row.querySelector('.img-wrap img.torn-item');
        if (!image || !['glow-yellow', 'glow-orange', 'glow-red'].some(name => image.classList.contains(name))) return null;
        const proficience = Boolean(row.querySelector('.bonus-attachment-experience'));
        if (armoryMode === 'ranked-no-prof' && proficience) return null;
        if (armoryMode === 'proficience-15-plus') {
          if (kind !== 'weapons' || !proficience) return null;
          const member = armoryMembers.find(item => item.id === borrower.id);
          if (!member || !Number.isFinite(Number(member.level)) || Number(member.level) < 15) return null;
        }
        if (!['ranked-all', 'ranked-no-prof', 'proficience-15-plus'].includes(armoryMode)) return null;
        return borrower;
      }

      function armorySetStatus(message, state = 'normal') {
        armoryStatus = message; armoryState = state;
        if (fullUi) render();
      }

      function normalizeArmoryRank(value) {
        return String(value ?? '').replace(/\s+/g, ' ').trim();
      }

      function sortArmoryMembers(members) {
        const rankIndex = new Map(armoryRankOrder.map((rank, index) => [normalizeArmoryRank(rank).toLowerCase(), index]));
        return [...members].sort((left, right) => {
          const leftRank = normalizeArmoryRank(left.rank) || 'Member';
          const rightRank = normalizeArmoryRank(right.rank) || 'Member';
          const leftIndex = rankIndex.get(leftRank.toLowerCase());
          const rightIndex = rankIndex.get(rightRank.toLowerCase());
          const leftCaptured = Number.isInteger(leftIndex);
          const rightCaptured = Number.isInteger(rightIndex);
          if (leftCaptured && rightCaptured && leftIndex !== rightIndex) return leftIndex - rightIndex;
          if (leftCaptured !== rightCaptured) return leftCaptured ? -1 : 1;
          return leftRank.localeCompare(rightRank, undefined, { sensitivity:'base', numeric:true })
            || String(left.name).localeCompare(String(right.name), undefined, { sensitivity:'base', numeric:true });
        });
      }

      function rankPanelIsVisible() {
        const panel = document.querySelector('#faction-rank');
        if (!panel) return false;
        const style = getComputedStyle(panel);
        return panel.getAttribute('aria-hidden') !== 'true' && style.display !== 'none' && panel.getClientRects().length > 0;
      }

      async function captureDisplayedRankOrder() {
        if (!pageIsFocused() || !rankPanelIsVisible() || !armoryMembers.length) return false;
        const knownRanks = new Map();
        for (const member of armoryMembers) {
          const rank = normalizeArmoryRank(member.rank);
          if (rank) knownRanks.set(rank.toLowerCase(), rank);
        }
        if (knownRanks.size < 2) return false;
        const found = []; const seen = new Set();
        const walker = document.createTreeWalker(document.querySelector('#faction-rank'), NodeFilter.SHOW_TEXT);
        let node;
        while ((node = walker.nextNode())) {
          const canonical = knownRanks.get(normalizeArmoryRank(node.nodeValue).toLowerCase());
          if (!canonical || seen.has(canonical.toLowerCase())) continue;
          seen.add(canonical.toLowerCase()); found.push(canonical);
        }
        if (found.length < 2 || JSON.stringify(found) === JSON.stringify(armoryRankOrder)) return found.length >= 2;
        armoryRankOrder = found;
        armoryMembers = sortArmoryMembers(armoryMembers);
        await Promise.all([
          SLINK.core.storage.set('war.armory.rankOrder.v1', armoryRankOrder),
          SLINK.core.storage.set('war.armory.memberCache.v1', { savedAt:armoryMembersSavedAt, members:armoryMembers, rankOrderCapturedAt:Date.now(), source:'v2 members + displayed Rank tab order' })
        ]);
        armorySetStatus(`Captured displayed hierarchy for ${found.length} ranks.`, 'success');
        return true;
      }

      function scheduleRankOrderCapture() {
        for (const timerId of armoryRankCaptureTimers) clearTimeout(timerId);
        armoryRankCaptureTimers = [200, 600, 1200, 2400, 4000].map(delay => setTimeout(() => void captureDisplayedRankOrder(), delay));
      }

      function handleRankTabClick(event) {
        if (event.target?.closest?.('[data-case="rank"],a[href*="#faction-rank"],[aria-controls="faction-rank"]')) scheduleRankOrderCapture();
      }

      async function ensureArmoryMembers(force = false) {
        const cached = await SLINK.core.storage.get('war.armory.memberCache.v1', null);
        if (!force && cached?.savedAt && Date.now() - Number(cached.savedAt) < 12 * 60 * 60_000 && Array.isArray(cached.members) && cached.members.length) {
          armoryMembers = sortArmoryMembers(cached.members);
          armoryMembersSavedAt = Number(cached.savedAt) || 0;
          return true;
        }
        if (!pageIsFocused()) { armorySetStatus('Focus this Torn tab before loading faction members.', 'error'); return false; }
        const result = await SLINK.core.messaging.send('war.armory.members', { force });
        armoryMembers = sortArmoryMembers(result?.members || []);
        armoryMembersSavedAt = Number(result?.fetchedAt) || Date.now();
        await SLINK.core.storage.set('war.armory.memberCache.v1', { savedAt:armoryMembersSavedAt, members:armoryMembers, source:armoryRankOrder.length ? 'v2 members + displayed Rank tab order' : 'v2 members + alphabetical ranks' });
        return armoryMembers.length > 0;
      }

      function armoryBonus(row) {
        const bonus = row.querySelector('.bonuses li.bonus [class*="bonus-attachment-"]');
        if (!bonus) return '';
        const title = String(bonus.getAttribute('title') || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
        const known = ['Revitalize', 'Warlord'].find(name => title.toLowerCase().includes(name.toLowerCase()) || [...bonus.classList].some(value => value.toLowerCase().includes(name.toLowerCase())));
        return known || title.split(' ')[0] || 'Ranked';
      }

      // Retrieval and pagination adapted from Considious Armory Recaller 1.2.6.
      async function retrieveOneArmoryItem(row, borrower) {
          const open = row.querySelector('.item-action [data-role="retrieve"].active');
          if (!open) throw new Error('Retrieve control was not found.');
          armorySetStatus(`Retrieving ${(row.querySelector('.name')?.textContent.trim() || 'item')} from ${borrower.name}…`);
          open.click();
          for (let attempt = 0; attempt < 20; attempt += 1) {
              await new Promise(resolve => setTimeout(resolve, 50));
              if (!pageIsFocused()) throw new Error('The Torn page lost focus before confirmation. Nothing else was clicked.');
              const confirm = row.querySelector('.retrieve-cont .retrieve-yes');
              if (confirm && confirm.getClientRects().length > 0) {
                  confirm.click();
                  return;
              }
          }
          throw new Error('Torn did not display the retrieval confirmation.');
      }

      function findNextArmoryPageControl(tab) {
          const roots = [tab, document.querySelector('#faction-armoury'), document].filter(Boolean);
          const selectors = [
              '.gallery-wrapper.pagination a[href] > i.pagination-right',
              '.pagination a[href] > i.pagination-right',
              '.pagination a.next:not(.disabled)',
              '.pagination .next:not(.disabled) a',
              'a[aria-label="Next"]',
              'a[title="Next"]',
              '[data-page="next"]',
          ];

          for (const root of roots) {
              for (const selector of selectors) {
                  const found = root.querySelector(selector);
                  if (!found) continue;
                  const control = found.matches('a, button') ? found : found.closest('a, button');
                  if (!control || control.disabled || control.classList.contains('disable') || control.classList.contains('disabled')) continue;
                  return control;
              }
          }

          return [...(tab?.querySelectorAll('a, button') || [])].find((el) => {
              const values = [el.textContent, el.getAttribute('aria-label'), el.getAttribute('title')].map((v) => (v || '').trim().toLowerCase());
              return values.includes('next') && !el.disabled && !el.classList.contains('disabled') && !el.classList.contains('disable');
          }) || null;
      }

      async function retrieveArmoryItem() {
        if (armoryBusy) return;
        armoryBusy = true;
        try {
          if (fullUi) render();
          if (!pageIsFocused()) throw new Error('Focus this Torn tab before retrieving an item.');
          const tab = activeArmoryTab();
          const kind = armoryTabKind(tab);
          if (!tab || !kind) throw new Error('Open the Weapons or Armor tab in Faction Armoury first.');
          if (armoryMode === 'proficience-15-plus' && !await ensureArmoryMembers()) return;
          if (!pageIsFocused()) throw new Error('The Torn tab lost focus. Nothing was retrieved.');
          let skippedWhitelist = 0;
          for (const row of tab.querySelectorAll('ul.item-list > li')) {
            if (armoryWhitelist.has(armoryBorrower(row)?.id)) skippedWhitelist++;
            const borrower = armoryEligibility(row, kind);
            if (!borrower) continue;
            const item = row.querySelector('.name')?.textContent.trim() || 'item';
            await retrieveOneArmoryItem(row, borrower);
            armorySetStatus(`Retrieved one ${item} from ${borrower.name}.`, 'success');
            return;
          }
          armorySetStatus(skippedWhitelist ? `No eligible items. Skipped ${skippedWhitelist} whitelisted loan${skippedWhitelist === 1 ? '' : 's'}.` : 'No eligible items remain on this page.', 'success');
        } catch (error) { armorySetStatus(SLINK.core.format.errorMessage(error), 'error'); }
        finally {
          armoryBusy = false;
          // Restore the button now, rather than waiting for the next War cycle.
          if (fullUi) render();
        }
      }

      function nextArmoryPage() {
          if (!pageIsFocused()) return armorySetStatus('Page is not focused. Page was not changed.', 'error');
          const tab = activeArmoryTab();
          if (!tab) return armorySetStatus('Open the Weapons or Armor armory tab.', 'error');
          const next = findNextArmoryPageControl(tab);
          if (!next) return armorySetStatus('No enabled Next Page control was found.', 'done');

          const href = next.getAttribute('href');
          next.click();

          // Torn's armory pagination is hash-routed. Fall back to assigning the
          // exact href when another script prevents the synthetic click.
          if (href?.startsWith('#') && location.hash !== href) {
              location.hash = href.slice(1);
          }
          armorySetStatus('Moved to the next page.');
      }

      function armoryHtml() {
        if (!current?.session?.officer) return '<div class="slink-war-error">slink.war.officer permission is required.</div>';
        const onArmory = Boolean(activeArmoryTab());
        const members = armoryMemberRowsHtml();
        return `<div class="slink-war-armory">
          ${onArmory ? '' : '<a class="slink-war-note" href="https://www.torn.com/factions.php?step=your#/tab=armoury">Open Faction Armoury, then choose Weapons or Armor</a>'}
          <div class="slink-war-armory-controls"><label>Recall mode<select id="slink-armory-mode"><option value="ranked-all" ${armoryMode === 'ranked-all' ? 'selected' : ''}>All ranked items</option><option value="ranked-no-prof" ${armoryMode === 'ranked-no-prof' ? 'selected' : ''}>Ranked except Proficience</option><option value="proficience-15-plus" ${armoryMode === 'proficience-15-plus' ? 'selected' : ''}>Proficience from level 15+</option></select></label></div>
          <div class="slink-war-armory-actions"><button id="slink-armory-retrieve" type="button" ${onArmory && !armoryBusy ? '' : 'disabled'}>${armoryBusy ? 'Working…' : 'Retrieve Next'}</button><button id="slink-armory-next" type="button" ${onArmory ? '' : 'disabled'}>Next Page</button></div>
          <div class="slink-war-armory-status" data-state="${armoryState}">${escape(armoryStatus)}</div>
          ${WAR.armoryTimestampHtml(armoryTimestampValue)}
          <details class="slink-war-armory-manager" data-slink-ui-key="war-armory-whitelist" ${armoryWhitelistOpen ? 'open' : ''}>
            <summary>Never retrieve from (<span id="slink-armory-whitelist-count">${armoryWhitelist.size}</span>)</summary>
            <input id="slink-armory-search" data-slink-preserve data-slink-ui-key="war-armory-search" class="slink-war-armory-search" type="search" value="${escape(armorySearch)}" placeholder="Search name, rank, or ID">
            <div class="slink-war-armory-manager-actions"><button id="slink-armory-members" type="button">Refresh if due</button><button id="slink-armory-select-shown" type="button">Select shown</button><button id="slink-armory-clear-shown" type="button">Clear shown</button></div>
            <div id="slink-armory-member-list" data-slink-preserve-scroll data-slink-ui-key="war-armory-member-list" class="slink-war-armory-members">${members || '<div class="slink-war-note">Load the faction roster to manage the whitelist.</div>'}</div>
          </details>
        </div>`;
      }

      function filteredArmoryMembers() {
        const needle = armorySearch.trim().toLowerCase();
        return sortArmoryMembers(armoryMembers).filter(member => !needle || `${member.name} ${member.rank} ${member.id}`.toLowerCase().includes(needle));
      }

      function armoryMemberRowsHtml() {
        return filteredArmoryMembers().map(member => `<label class="slink-war-armory-member" data-armory-search="${escape(`${member.name} ${member.rank} ${member.id}`.toLowerCase())}"><input type="checkbox" data-armory-member="${member.id}" ${armoryWhitelist.has(String(member.id)) ? 'checked' : ''}><span><strong>${escape(member.name)}</strong><small>${escape(member.rank)} · level ${Number(member.level) || '?'} · ID ${member.id}</small></span></label>`).join('');
      }

      function bindArmoryMemberCheckboxes(root) {
        for (const input of root.querySelectorAll('[data-armory-member]')) input.addEventListener('change', async () => {
          if (input.checked) armoryWhitelist.add(input.dataset.armoryMember); else armoryWhitelist.delete(input.dataset.armoryMember);
          root.querySelector('#slink-armory-whitelist-count').textContent = String(armoryWhitelist.size);
          await SLINK.core.storage.set('war.armory.whitelist.v1', [...armoryWhitelist]);
        });
      }

      function renderArmoryMemberList(root) {
        const list = root.querySelector('#slink-armory-member-list');
        if (!list) return;
        const scrollTop = list.scrollTop;
        list.innerHTML = armoryMemberRowsHtml() || '<div class="slink-war-note">No faction members match that search.</div>';
        list.scrollTop = scrollTop;
        bindArmoryMemberCheckboxes(root);
      }

      async function setShownArmoryMembers(checked) {
        for (const member of filteredArmoryMembers()) {
          if (checked) armoryWhitelist.add(String(member.id)); else armoryWhitelist.delete(String(member.id));
        }
        await SLINK.core.storage.set('war.armory.whitelist.v1', [...armoryWhitelist]);
        render();
      }

      function assignmentControls() {
        if (!current?.session?.authenticated) return '';
        const officer = current.session.officer === true;
        return `<div class="slink-war-settings slink-war-note"><label>Target Torn ID<input id="slink-war-claim-target-id" type="number" min="1" placeholder="Required"></label><label>Target name<input id="slink-war-claim-target-name" type="text" maxlength="80" placeholder="Optional"></label>${officer ? '<label>Assign to Torn ID<input id="slink-war-assignee-id" type="number" min="1" placeholder="Blank = yourself"></label><label>Assignee name<input id="slink-war-assignee-name" type="text" maxlength="80" placeholder="Optional"></label>' : ''}<div class="slink-war-settings-actions"><button id="slink-war-claim-submit" type="button">Claim med partner</button></div></div>`;
      }

      function memberContext(member) {
        const description = String(member?.statusDescription || '').trim();
        if (!description || description.toLowerCase() === String(member?.statusState || '').trim().toLowerCase()) return '';
        return `<span class="slink-war-context">${escape(description)}</span>`;
      }
      function targetFilterControls() {
        const locations = WAR.travelLocations(current?.runtime?.snapshot?.members || []);
        if (!locations.includes(targetFilters.location)) targetFilters.location = 'all';
        const locationOptions = ['<option value="all">All locations</option>', ...locations.map(location => `<option value="${escape(location)}" ${targetFilters.location === location ? 'selected' : ''}>${escape(location)}</option>`)].join('');
        return `<div class="slink-war-settings slink-war-note"><label>Minimum FF<input id="slink-war-filter-min" type="number" min="0" step="0.1" value="${targetFilters.minFF}"></label><label>Maximum FF<input id="slink-war-filter-max" type="number" min="0" step="0.1" value="${targetFilters.maxFF}"></label><label>Status<select id="slink-war-filter-status"><option value="all" ${targetFilters.status === 'all' ? 'selected' : ''}>All statuses</option><option value="okay" ${targetFilters.status === 'okay' ? 'selected' : ''}>Okay only</option><option value="notOkay" ${targetFilters.status === 'notOkay' ? 'selected' : ''}>Not okay only</option></select></label><label>Abroad<select id="slink-war-filter-abroad"><option value="all" ${targetFilters.abroad === 'all' ? 'selected' : ''}>Show all targets</option><option value="hide" ${targetFilters.abroad === 'hide' ? 'selected' : ''}>Hide abroad</option><option value="only" ${targetFilters.abroad === 'only' ? 'selected' : ''}>Abroad only</option></select></label><label ${targetFilters.abroad === 'only' ? '' : 'hidden'}>Location<select id="slink-war-filter-location">${locationOptions}</select></label><label>Sort<select id="slink-war-filter-sort"><option value="availability" ${targetSort === 'availability' ? 'selected' : ''}>Availability</option><option value="fairFightDesc" ${targetSort === 'fairFightDesc' ? 'selected' : ''}>FF high to low</option><option value="fairFightAsc" ${targetSort === 'fairFightAsc' ? 'selected' : ''}>FF low to high</option></select></label></div>`;
      }
      function targetShareKey(member) {
        return `war:target:${Number(member?.id) || 0}`;
      }

      function retalShareKey(retal) {
        return `war:retal:${String(retal?.attackId || retal?.attackerId || '')}`;
      }

      async function copyCallout(member, button) {
        const result = await SLINK.core.factionChat.prime(WAR.factionCallout(member), { key:targetShareKey(member) });
        const original = button.textContent;
        button.textContent = result.label;
        updateWarSendButtons();
        setTimeout(() => { if (button.isConnected) button.textContent = original; }, 1400);
      }

      async function sendCallout(member, button) {
        const original = button.textContent;
        button.disabled = true;
        button.textContent = 'Sending…';
        const result = await SLINK.core.factionChat.sendPrimed({ key:targetShareKey(member) });
        button.textContent = result.label;
        updateWarSendButtons();
        setTimeout(() => { if (button.isConnected) button.textContent = original; }, 1400);
      }

      function retalCallout(retal) {
        const faction = retal.attackerFactionName || (retal.attackerFactionId ? `Faction ${retal.attackerFactionId}` : 'No faction');
        const flags = [retal.isRetal ? 'Retal' : '', retal.isWar ? 'War' : ''].filter(Boolean);
        const estimates = [
          Number.isFinite(retal.fairFight) ? `FF ${retal.fairFight.toFixed(2)}` : '',
          Number.isFinite(retal.battleStatsEstimate) ? `~${SLINK.core.format.shortNumber(retal.battleStatsEstimate)} total` : ''
        ].filter(Boolean);
        const details = [
          faction,
          ...flags,
          retal.defenderName ? `Attacked: ${retal.defenderName}${retal.defenderId ? ` [${retal.defenderId}]` : ''}` : '',
          `Status: ${retal.attackerStatus || retal.attackerActivity || 'Unknown'}`
        ].filter(Boolean);
        const name = escape(retal.attackerName || `Player ${retal.attackerId}`);
        return `🚨 Retaliation: Please Hospitalize 🚨<br><a href="${profileUrl(retal.attackerId)}">${name} [${retal.attackerId}]</a> - ${SLINK.core.format.attackLink(attackUrl(retal.attackerId))} - (${escape(estimates.join(' | ') || 'Estimate unavailable')})${details.length ? `<br>${escape(details.join(' • '))}` : ''}`;
      }

      async function copyRetal(retal, button) {
        const result = await SLINK.core.factionChat.prime(retalCallout(retal), { key:retalShareKey(retal) });
        const original = button.textContent;
        button.textContent = result.label;
        updateWarSendButtons();
        setTimeout(() => { if (button.isConnected) button.textContent = original; }, 1400);
      }

      function updateWarSendButtons() {
        const root = fullUi ? context.ui.getContentElement() : null;
        if (!root) return;
        for (const button of root.querySelectorAll('[data-war-send]')) {
          button.disabled = !SLINK.core.factionChat.isPrimed(`war:target:${button.dataset.warSend}`);
          button.title = button.disabled ? 'Copy this target first' : 'Send the copied target to Faction Chat';
        }
        for (const button of root.querySelectorAll('[data-war-retal-send]')) {
          button.disabled = !SLINK.core.factionChat.isPrimed(`war:retal:${button.dataset.warRetalSend}`);
          button.classList.toggle('slink-war-chat-authorized', !button.disabled);
          button.title = button.disabled ? 'Copy this retaliation first' : 'Send the copied retaliation to Faction Chat';
        }
      }

      async function sendRetal(retal, button) {
        const original = button.textContent;
        button.disabled = true;
        button.textContent = 'Sending…';
        const result = await SLINK.core.factionChat.sendPrimed({ key:retalShareKey(retal) });
        button.textContent = result.label;
        localError = result.ok ? '' : result.label;
        updateWarSendButtons();
        setTimeout(() => { if (button.isConnected) button.textContent = original; }, 1400);
      }

      function targetCards() {
        const minimum = Math.min(Number(targetFilters.minFF) || 1, Number(targetFilters.maxFF) || 3);
        const maximum = Math.max(Number(targetFilters.minFF) || 1, Number(targetFilters.maxFF) || 3);
        const members = WAR.sortMembers(current?.runtime?.snapshot?.members || [], Date.now(), targetSort).filter(member => {
          const ff = Number(member.fairFight);
          if (!Number.isFinite(ff) || ff < minimum || ff > maximum) return false;
          const okay = /^okay$/i.test(String(member.statusState || '').trim());
          const abroad = WAR.isAbroad(member);
          if (targetFilters.abroad === 'hide' && abroad) return false;
          if (targetFilters.abroad === 'only' && !abroad) return false;
          if (targetFilters.abroad === 'only' && targetFilters.location !== 'all' && WAR.travelLocation(member) !== targetFilters.location) return false;
          return targetFilters.status === 'okay' ? okay : targetFilters.status === 'notOkay' ? !okay : true;
        });
        if (!members.length) return targetFilterControls() + assignmentControls() + '<div class="slink-war-empty">No targets match the current Fair Fight, status, and travel filters.</div>';
        return targetFilterControls() + assignmentControls() + members.map(member => {
          const hospitalized = WAR.isHospitalized(member);
          const remaining = WAR.statusSeconds(member);
          const readyAt = hospitalized ? WAR.tctTime(member.statusUntil) : '';
          const gate = insideGate(member.id);
          return `<article class="slink-war-card" ${gate.active ? 'data-inside-blocked="true"' : ''}>
            <div class="slink-war-card-head"><a href="${profileUrl(member.id)}" target="_blank" rel="noopener noreferrer">${escape(member.name)} [${member.id}]</a><span>Lv ${member.level || '?'}</span></div>
            <div class="slink-war-meta"><span class="slink-war-pill ${member.activity === 'Online' ? 'slink-war-online' : ''}">${escape(member.activity || 'Unknown')}</span><span class="slink-war-pill ${hospitalized ? 'slink-war-hospital' : ''}">${escape(member.statusState || 'Okay')}${hospitalized ? ` ${duration(remaining)}${readyAt ? ` / ${readyAt} TCT` : ''}` : ''}</span><span class="slink-war-pill">Estimated BS ${Number.isFinite(member.battleStatsEstimate) ? SLINK.core.format.shortNumber(member.battleStatsEstimate) : '?'}</span><span class="slink-war-pill">FF ${Number.isFinite(member.fairFight) ? member.fairFight.toFixed(2) : '?'}</span>${memberContext(member)}</div>
            ${gate.active ? `<div class="slink-war-inside-disabled">${escape(insideGateMessage(gate))}</div>` : ''}
            <div class="slink-war-card-actions"><a href="${attackUrl(member.id)}" data-war-attack="${member.id}" target="_blank" rel="noopener noreferrer">${gate.active && gate.mode === 'block' ? 'INSIDES DISABLED' : '【ATTACK】'}</a><a href="${profileUrl(member.id)}" target="_blank" rel="noopener noreferrer">Profile</a><button data-war-save-target="${member.id}" data-war-save-source="war" type="button">Save Target</button><button data-war-copy="${member.id}" type="button">Copy</button><button data-war-send="${member.id}" type="button" disabled>Send to Faction</button></div>
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
          <div class="slink-war-meta"><span class="slink-war-pill">${escape(member.activity || 'Unknown')}</span><span class="slink-war-pill">${escape(member.statusState || 'Unknown')}</span><span class="slink-war-pill">Estimated BS ${Number.isFinite(member.battleStatsEstimate) ? SLINK.core.format.shortNumber(member.battleStatsEstimate) : '?'}</span><span class="slink-war-pill">FF ${Number.isFinite(member.fairFight) ? member.fairFight.toFixed(2) : '?'}</span>${memberContext(member)}</div>
          <div class="slink-war-card-actions"><a href="${attackUrl(member.id)}" data-war-attack="${member.id}" target="_blank" rel="noopener noreferrer">【ATTACK】</a><a href="${profileUrl(member.id)}" target="_blank" rel="noopener noreferrer">Profile</a><button data-war-save-target="${member.id}" data-war-save-source="outside" type="button">Save Target</button><button data-war-copy="${member.id}" type="button">Copy</button><button data-war-send="${member.id}" type="button" disabled>Send to Faction</button></div>
        </article>`).join('');
        return controls + message + cards;
      }

      function claimCards() {
        const claims = current?.runtime?.snapshot?.claims || [];
        if (!claims.length) return assignmentControls() + '<div class="slink-war-empty">No med-out targets are currently claimed.</div>';
        return assignmentControls() + claims.map(claim => {
          const mine = Number(claim.claimedById) === Number(current?.session?.userId);
          return `<article class="slink-war-card">
            <div class="slink-war-card-head"><a href="${profileUrl(claim.targetId)}" target="_blank" rel="noopener noreferrer">${escape(claim.targetName || `Player ${claim.targetId}`)} [${claim.targetId}]</a><span>${duration((Number(claim.expiresAt) - Date.now()) / 1000)}</span></div>
            <div class="slink-war-meta"><span class="slink-war-pill">Claimed by ${escape(claim.claimedByName || claim.claimedById)}</span></div>
            ${mine || current?.session?.officer ? `<div class="slink-war-card-actions"><button data-war-release="${claim.targetId}" type="button">Release claim</button></div>` : ''}
          </article>`;
        }).join('');
      }

      function itemRequestCards() {
        const requests = current?.runtime?.snapshot?.itemRequests || [];
        if (!requests.length) return '';
        return `<div class="slink-war-note"><strong>Armory item requests</strong>${requests.map(request => `<article class="slink-war-card">
          <div class="slink-war-card-head"><a href="${profileUrl(request.requesterId)}" target="_blank" rel="noopener noreferrer">${escape(playerName(request.requesterName, request.requesterId))} [${request.requesterId}]</a><span>${escape(request.bonusName || 'Ranked')}</span></div>
          <div class="slink-war-meta"><span class="slink-war-pill">${escape(request.itemName || 'Item')}</span><span class="slink-war-pill">Held by ${escape(request.holderName || `Player ${request.holderId}`)} [${request.holderId}]</span><span>${escape(request.holderStatus || 'Unknown')} • ${escape(request.holderLastAction || 'Unknown')}</span></div>
          <div class="slink-war-card-actions"><a href="${escape(request.armoryUrl || 'https://www.torn.com/factions.php?step=your#/tab=armoury')}" target="_blank" rel="noopener noreferrer">Open armory</a><button data-armory-request-resolve="${escape(request.requestId)}" type="button">Dismiss</button></div>
        </article>`).join('')}</div>`;
      }

      function retalCards() {
        const retals = visibleRetals();
        if (!retals.length) return '<div class="slink-war-empty">No active retaliation alerts.</div>';
        const now = Math.floor(Date.now() / 1000);
        return retals.map(retal => {
          const faction = retal.attackerFactionName || (retal.attackerFactionId ? `Faction ${retal.attackerFactionId}` : 'No faction');
          const tag = retal.attackerFactionTag ? ` [${retal.attackerFactionTag}]` : '';
          const status = retal.attackerStatus || retal.attackerActivity || 'Unknown';
          const readyAt = /hospital/i.test(status) && Number(retal.attackerStatusUntil) ? WAR.tctTime(retal.attackerStatusUntil) : '';
          return `<article class="slink-war-card slink-war-retal"><button class="slink-war-retal-dismiss" data-war-retal-dismiss="${escape(retal.attackId)}" type="button" title="Dismiss alerts for this player" aria-label="Dismiss alerts for ${escape(retal.attackerName || `Player ${retal.attackerId}`)}">×</button>
          <div class="slink-war-card-head"><a href="${profileUrl(retal.attackerId)}" target="_blank" rel="noopener noreferrer">${escape(retal.attackerName || `Player ${retal.attackerId}`)} [${retal.attackerId}]</a><span>${duration(Number(retal.expiresAt) - now)}</span></div>
          <div class="slink-war-meta">${retal.isWar ? '<span class="slink-war-pill">⚔ War</span>' : ''}${retal.isRetal ? '<span class="slink-war-pill">🛡 Retal</span>' : ''}</div>
          <div class="slink-war-retal-report"><span>Faction</span><span>${escape(faction + tag)}</span><span>Attacked</span><span>${escape(retal.defenderName || `Player ${retal.defenderId}`)}${retal.defenderId ? ` [${retal.defenderId}]` : ''}</span><span>Status</span><span>${escape(status)}${readyAt ? ` • out ${escape(readyAt)} TCT` : ''}${retal.attackerStatusDescription ? ` • ${escape(retal.attackerStatusDescription)}` : ''}</span><span>Estimated BS</span><span>${Number.isFinite(retal.battleStatsEstimate) ? SLINK.core.format.shortNumber(retal.battleStatsEstimate) : 'Unknown'}</span><span>Fair Fight</span><span>${Number.isFinite(retal.fairFight) ? retal.fairFight.toFixed(2) : 'Unknown'}</span></div>
          <div class="slink-war-card-actions"><button data-war-retal-copy="${retal.attackId}" type="button">📋 Copy</button><button data-war-retal-send="${retal.attackId}" type="button" disabled title="Press Copy first. Send remains available for 30 seconds.">💬 Send</button><a class="slink-war-retal-attack" href="${attackUrl(retal.attackerId)}" data-war-attack="${retal.attackerId}" target="_blank" rel="noopener noreferrer">⚔ 【ATTACK】</a><a href="${profileUrl(retal.attackerId)}" target="_blank" rel="noopener noreferrer">Profile</a></div>
        </article>`;
        }).join('');
      }

      function playerName(value, id) {
        const raw = String(value || '').trim();
        const numericId = Number(id) || 0;
        const rosterName = armoryMembers.find(member => Number(member.id) === numericId)?.name;
        if (rosterName) return rosterName;
        if (numericId === Number(current?.session?.userId) && current?.session?.userName) return current.session.userName;
        if (!raw || raw === String(numericId) || raw.toLowerCase() === `player ${numericId}`.toLowerCase()) return 'Player';
        return raw;
      }

      function logCards() {
        const logs = current?.runtime?.logs || [];
        if (!logs.length) return '<div class="slink-war-empty">No loss, escape, or online-hit counters yet.</div>';
        const grouped = new Map();
        for (const row of logs) {
          const id = Number(row.attacker_id) || 0;
          if (!grouped.has(id)) grouped.set(id, { id, name:String(row.attacker_name || `Player ${id}`), total:0, loss:0, escape:0, online:0, rows:[] });
          const group = grouped.get(id);
          const count = Number(row.event_count) || 0;
          const outcome = String(row.outcome || 'unknown');
          group.total += count;
          if (outcome === 'loss') group.loss += count;
          else if (outcome === 'escape') group.escape += count;
          else if (outcome === 'online_hit') group.online += count;
          group.rows.push(row);
        }
        return [...grouped.values()].sort((a, b) => b.total - a.total).map(group => {
          const metrics = [`${group.total} recorded`, group.loss ? `${group.loss} lost` : '', group.escape ? `${group.escape} escaped` : '', group.online ? `${group.online} online hits` : ''].filter(Boolean).join(' • ');
          const events = group.rows.sort((a, b) => Number(b.last_seen_at) - Number(a.last_seen_at)).map(row => {
            const seen = new Date(Number(row.last_seen_at) || 0);
            return `<div class="slink-war-log-event"><strong>${escape(String(row.outcome || '').replace('_', ' '))} × ${Number(row.event_count) || 0}</strong><br><a href="${profileUrl(row.defender_id)}" target="_blank" rel="noopener noreferrer">${escape(row.defender_name || `Player ${row.defender_id}`)} [${row.defender_id}]</a><br><span>${escape(seen.toLocaleDateString())} • ${escape(seen.toLocaleTimeString())}${row.observed_status ? ` • observed ${escape(row.observed_status)}` : ''}</span></div>`;
          }).join('');
          return `<details class="slink-war-log-person"><summary><span><strong>${escape(group.name)}${group.id ? ` [${group.id}]` : ''}</strong><br><small>${escape(metrics)}</small></span><span>Details</span></summary><div class="slink-war-log-events">${events}</div></details>`;
        }).join('');
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
          <label>Inside-hit cap<input id="slink-war-inside-cap" type="number" min="0" max="9999" value="${Number(shared.insideHitCap) || 0}" ${officer ? '' : 'disabled'}></label>
          <label>Major-window inside gate<select id="slink-war-inside-mode" ${officer ? '' : 'disabled'}><option value="off" ${shared.insideBlockMode === 'off' ? 'selected' : ''}>Off</option><option value="warn" ${(shared.insideBlockMode || 'warn') === 'warn' ? 'selected' : ''}>Warning with override</option><option value="block" ${shared.insideBlockMode === 'block' ? 'selected' : ''}>Hard block</option></select></label>
          <div class="wide slink-war-note">${officer ? 'War mode, idle filtering, inside cap, and the major-window inside gate apply to everyone in your faction. The gate only activates in Termed mode.' : `Faction-wide mode is ${shared.mode === 'termed' ? 'Termed war' : 'Real war'}. A slink.war.officer may change it.`}</div>
          <label>Target sort<select id="slink-war-sort"><option value="availability" ${targetSort === 'availability' ? 'selected' : ''}>Availability</option><option value="fairFightDesc" ${targetSort === 'fairFightDesc' ? 'selected' : ''}>FF high to low</option><option value="fairFightAsc" ${targetSort === 'fairFightAsc' ? 'selected' : ''}>FF low to high</option></select></label>
          <div class="slink-war-settings-actions"><button id="slink-war-save" type="button">Save War settings</button><button id="slink-war-clear" type="button">Clear War session</button></div>
        </div>`;
      }

      function render() {
        if (!fullUi) return;
        const root = context.ui.getContentElement();
        const preservedUi = SLINK.core.uiState?.capture(root);
        const snapshot = current?.runtime?.snapshot || {};
        const stats = current?.runtime?.panelStats || {};
        const canViewLogs = current?.session?.canViewLogs === true;
        const officer = current?.session?.officer === true;
        if ((activeTab === 'logs' && !canViewLogs) || (activeTab === 'armory' && !officer)) {
          activeTab = 'targets';
          void SLINK.core.storage.set('ui.war.activeTab.v1', activeTab);
        }
        const phaseLabel = current?.activeWar?.phase === 'scheduled' ? 'Assigned' : current?.activeWar?.phase === 'prewar' ? 'Pre-war' : current?.activeWar?.phase === 'active' ? 'Active' : '';
        context.ui.setSubtitle(current?.session?.authenticated ? `${current.session.factionCapable ? 'Faction API' : 'Public API'} / ${current.activeWar?.opponentName || 'No assigned opponent'}${phaseLabel ? ` / ${phaseLabel}` : ''}` : 'Setup required');
        context.ui.setStatus(localError || current?.runtime?.lastError || current?.runtime?.status || 'SLINK War ready.', (localError || current?.runtime?.lastError) ? 'error' : (current?.configured ? 'ready' : 'normal'));
        context.ui.setActions([{ label:busy ? 'Refreshing...' : 'Refresh', disabled:busy, onClick:() => runCycle(true) }]);
        const tabs = ['targets', 'outside', 'claims', ...(officer ? ['armory'] : []), ...(canViewLogs ? ['logs'] : []), 'settings'];
        const body = activeTab === 'targets' ? targetCards() : activeTab === 'outside' ? outsideCards() : activeTab === 'claims' ? claimCards() : activeTab === 'armory' ? armoryHtml() : activeTab === 'logs' ? logCards() : settingsHtml();
        const chain = stats.chain?.current ? `${stats.chain.current}${stats.chain.target ? `/${stats.chain.target}` : ''}` : 'None';
        const insideCap = Math.max(0, Number(current?.sharedConfig?.insideHitCap) || 0);
        const mugSummary = Number(stats.mugs)
          ? `${Number(stats.mugs)} mugs • ${money(stats.mugTotal)} total • ${money(stats.mugMin)} min • ${money(stats.mugAverage)} avg • ${money(stats.mugMax)} max`
          : 'Mug totals appear after a mug.';
        const retals = visibleRetals();
        const armoryRequestCount = officer ? (snapshot.itemRequests || []).length : 0;
        const tabBar = `<div class="slink-war-subtabs">${tabs.map(tab => `<button class="slink-war-subtab" data-war-tab="${tab}" aria-selected="${activeTab === tab}"><span>${tab[0].toUpperCase()}${tab.slice(1)}</span>${tab === 'armory' && armoryRequestCount ? `<span class="nav-alert-count" aria-label="${armoryRequestCount} active Armory requests">${armoryRequestCount > 99 ? '99+' : armoryRequestCount}</span>` : ''}</button>`).join('')}</div>`;
        const content = activeTab === 'armory'
          ? `${tabBar}<div>${body}</div>`
          : `${tabBar}<div class="slink-war-summary"><div class="slink-war-stat"><b>${Number(stats.attacks) || 0}</b><span>Attacks</span></div><div class="slink-war-stat"><b>${Number(stats.warAttacks) || 0}${insideCap ? `/${insideCap}` : ''}</b><span>War / cap</span></div><div class="slink-war-stat"><b>${Number(stats.mugs) || 0}</b><span>Mugs</span></div><div class="slink-war-stat"><b>${chain}</b><span>Chain</span></div></div><div class="slink-war-note slink-war-report"><span>${mugSummary}</span><button id="slink-war-copy-report" type="button">Copy report</button></div>${itemRequestCards()}${retals.length ? `<div class="slink-war-note"><strong>Active retals</strong>${retalCards()}</div>` : ''}${localError ? `<div class="slink-war-error">${escape(localError)}</div>` : ''}<div>${body}</div>`;
        context.ui.setContentHtml(content);
        bindEvents();
        SLINK.core.uiState?.restore(context.ui.getContentElement(), preservedUi);
      }

      function bindEvents() {
        const root = context.ui.getContentElement();
        for (const button of root.querySelectorAll('[data-war-tab]')) button.addEventListener('click', () => {
          activeTab = button.dataset.warTab;
          void SLINK.core.storage.set('ui.war.activeTab.v1', activeTab);
          render();
        });
        root.querySelector('#slink-armory-mode')?.addEventListener('change', async event => {
          armoryMode = event.currentTarget.value;
          await SLINK.core.storage.set('war.armory.mode.v1', armoryMode);
          render();
        });
        root.querySelector('#slink-armory-retrieve')?.addEventListener('click', () => void retrieveArmoryItem());
        root.querySelector('#slink-armory-next')?.addEventListener('click', nextArmoryPage);
        root.querySelector('[data-armory-time]')?.addEventListener('input', event => {
          armoryTimestampValue = event.currentTarget.value;
          WAR.updateArmoryTimestamp(root, armoryTimestampValue);
        });
        root.querySelector('[data-armory-copy]')?.addEventListener('click', async () => {
          const result = WAR.discordTimestamp(armoryTimestampValue);
          if (!result) return;
          const message = root.querySelector('[data-armory-time-message]');
          try { await navigator.clipboard.writeText(result.code); message.textContent = 'Copied — paste into Discord.'; }
          catch { root.querySelector('[data-armory-code]')?.select(); message.textContent = 'Select and copy the timestamp above.'; }
        });
        root.querySelector('#slink-armory-members')?.addEventListener('click', async event => {
          event.currentTarget.disabled = true;
          try { if (await ensureArmoryMembers(false)) armorySetStatus(`Loaded ${armoryMembers.length} faction members.`, 'success'); }
          catch (error) { armorySetStatus(SLINK.core.format.errorMessage(error), 'error'); }
        });
        bindArmoryMemberCheckboxes(root);
        root.querySelector('.slink-war-armory-manager')?.addEventListener('toggle', event => { armoryWhitelistOpen = event.currentTarget.open; });
        root.querySelector('#slink-armory-search')?.addEventListener('input', event => {
          armorySearch = event.currentTarget.value;
          renderArmoryMemberList(root);
        });
        root.querySelector('#slink-armory-select-shown')?.addEventListener('click', () => void setShownArmoryMembers(true));
        root.querySelector('#slink-armory-clear-shown')?.addEventListener('click', () => void setShownArmoryMembers(false));
        root.querySelector('#slink-war-copy-report')?.addEventListener('click', async event => {
          const button = event.currentTarget;
          button.disabled = true;
          try {
            const result = await SLINK.core.messaging.send('war.chain.report');
            await navigator.clipboard.writeText(result.text);
            button.textContent = 'Copied';
            localError = '';
          } catch (error) {
            localError = SLINK.core.format.errorMessage(error);
            render();
          } finally {
            if (button.isConnected) button.disabled = false;
          }
        });
        const members = new Map([...(current?.runtime?.snapshot?.members || []), ...(current?.runtime?.outsideTargets || [])].map(member => [Number(member.id), member]));
        const retals = new Map((current?.runtime?.snapshot?.retals || []).map(retal => [String(retal.attackId), retal]));
        for (const button of root.querySelectorAll('[data-war-save-target]')) button.addEventListener('click', async () => {
          const targetId = Number(button.dataset.warSaveTarget);
          const source = button.dataset.warSaveSource === 'outside' ? 'outside-targets' : 'war';
          const rows = source === 'war' ? (current?.runtime?.snapshot?.members || []) : (current?.runtime?.outsideTargets || []);
          const member = rows.find(row => Number(row.id) === targetId);
          if (!member) return;
          const original = button.textContent;
          button.disabled = true;
          button.textContent = 'Saving…';
          try {
            await SLINK.core.messaging.send('targetList.add', {
              playerId:targetId,
              name:member.name,
              tags:[source === 'war' ? 'War' : 'Target'],
              source,
              sourceLabel:source === 'war' ? 'War Panel' : 'Outside Targets',
              sourceContext:{
                warId:String(current?.activeWar?.warId || current?.activeWar?.id || ''),
                fairFight:Number(member.fairFight) || 0,
                battleStatsEstimate:Number(member.battleStatsEstimate) || 0
              },
              status:{
                state:member.statusState,
                until:Number(member.statusUntil) || 0,
                description:member.statusDescription || member.statusState || '',
                source
              }
            });
            button.textContent = 'Saved';
            localError = '';
          } catch (error) {
            button.textContent = 'Save failed';
            button.title = SLINK.core.format.errorMessage(error);
            localError = button.title;
          } finally {
            setTimeout(() => {
              if (!button.isConnected) return;
              button.disabled = false;
              button.textContent = original;
            }, 1400);
          }
        });
        for (const button of root.querySelectorAll('[data-war-copy]')) button.addEventListener('click', () => void copyCallout(members.get(Number(button.dataset.warCopy)), button).catch(error => { localError=SLINK.core.format.errorMessage(error); render(); }));
        for (const button of root.querySelectorAll('[data-war-send]')) button.addEventListener('click', () => void sendCallout(members.get(Number(button.dataset.warSend)), button));
        for (const button of root.querySelectorAll('[data-war-retal-copy]')) button.addEventListener('click', () => void copyRetal(retals.get(String(button.dataset.warRetalCopy)), button).catch(error => { localError=SLINK.core.format.errorMessage(error); render(); }));
        for (const button of root.querySelectorAll('[data-war-retal-send]')) button.addEventListener('click', () => void sendRetal(retals.get(String(button.dataset.warRetalSend)), button));
        for (const button of root.querySelectorAll('[data-war-retal-dismiss]')) button.addEventListener('click', () => void dismissRetal(retals.get(String(button.dataset.warRetalDismiss))));
        for (const link of root.querySelectorAll('[data-war-attack]')) link.addEventListener('click', event => void handleAttackLink(event, Number(link.dataset.warAttack)));
        for (const id of ['slink-war-filter-min', 'slink-war-filter-max', 'slink-war-filter-status', 'slink-war-filter-abroad', 'slink-war-filter-location', 'slink-war-filter-sort']) root.querySelector(`#${id}`)?.addEventListener('change', async () => {
          targetFilters = {
            minFF:Math.max(0, Number(root.querySelector('#slink-war-filter-min')?.value) || 0),
            maxFF:Math.max(0, Number(root.querySelector('#slink-war-filter-max')?.value) || 3),
            status:root.querySelector('#slink-war-filter-status')?.value || 'all',
            abroad:root.querySelector('#slink-war-filter-abroad')?.value || 'all',
            location:root.querySelector('#slink-war-filter-location')?.value || 'all'
          };
          targetSort = root.querySelector('#slink-war-filter-sort')?.value || 'availability';
          await SLINK.core.storage.set('ui.war.targetFilters.v1', { ...targetFilters, sort:targetSort });
          render();
        });
        root.querySelector('#slink-war-claim-submit')?.addEventListener('click', async event => {
          const button = event.currentTarget;
          const targetId = Number(root.querySelector('#slink-war-claim-target-id')?.value) || 0;
          if (!targetId) { localError='Enter the med-out target Torn ID.'; render(); return; }
          const member = (current?.runtime?.snapshot?.members || []).find(row => Number(row.id) === targetId);
          const targetName = String(root.querySelector('#slink-war-claim-target-name')?.value || '').trim() || member?.name || `Player ${targetId}`;
          const assigneeId = current?.session?.officer ? Number(root.querySelector('#slink-war-assignee-id')?.value) || 0 : 0;
          const assigneeName = current?.session?.officer ? String(root.querySelector('#slink-war-assignee-name')?.value || '').trim() : '';
          button.disabled = true;
          try {
            current = await SLINK.core.messaging.send('war.claims.update', { operation:'claim', targetId, targetName, assigneeId, assigneeName });
            localError = '';
          } catch (error) { localError=SLINK.core.format.errorMessage(error); }
          render();
        });
        for (const button of root.querySelectorAll('[data-armory-request-resolve]')) button.addEventListener('click', async () => {
          try {
            current = await SLINK.core.messaging.send('war.armory.request', { operation:'resolve', requestId:button.dataset.armoryRequestResolve });
            localError = '';
            render();
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
        root.querySelector('#slink-war-clear')?.addEventListener('click', async () => {
          try { current = await SLINK.core.messaging.send('war.session.clear'); localError=''; render(); }
          catch (error) { localError=SLINK.core.format.errorMessage(error); render(); }
        });
        root.querySelector('#slink-war-save')?.addEventListener('click', async () => {
          try {
            current = await SLINK.core.messaging.send('war.settings.save', {
              displayMode:root.querySelector('#slink-war-display')?.value,
              acceptTerms:root.querySelector('#slink-war-accept')?.checked === true
            });
            if (current?.session?.officer) current = await SLINK.core.messaging.send('war.config.save', {
              mode:root.querySelector('#slink-war-mode')?.value,
              idleMinutes:root.querySelector('#slink-war-idle')?.value,
              insideHitCap:root.querySelector('#slink-war-inside-cap')?.value,
              insideBlockMode:root.querySelector('#slink-war-inside-mode')?.value
            });
            targetSort = root.querySelector('#slink-war-sort')?.value || targetSort;
            localError = '';
            render();
            void runCycle(true);
          } catch (error) { localError = SLINK.core.format.errorMessage(error); render(); }
        });
        updateWarSendButtons();
      }

      async function dismissedRetals() {
        const values = await SLINK.core.storage.get('war.dismissedRetals.v1', {});
        const now = Math.floor(Date.now() / 1000);
        return Object.fromEntries(Object.entries(values || {}).filter(([, expiresAt]) => Number(expiresAt) > now));
      }

      function playAlertTone() {
        void SLINK.core.messaging.send('audio.play', { soundChoice:'urgent' }).catch(() => {});
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
        const retals = visibleRetals();
        const itemRequests = current?.session?.officer ? (current?.runtime?.snapshot?.itemRequests || []) : [];
        const chainDanger = settings.chainAlert && Number(stats.chain?.current) >= 50 && Number(stats.chain?.secondsLeft) > 0 && Number(stats.chain.secondsLeft) <= 90;
        const turtleRemaining = Number(stats.turtle?.until) - Math.floor(Date.now() / 1000);
        const turtleDanger = settings.turtleAlert && stats.turtle?.hospitalized && turtleRemaining > 0 && turtleRemaining <= (Number(settings.turtleMinutes) || 5) * 60;
        const active = Boolean(retals.length || itemRequests.length || chainDanger || turtleDanger);
        const signature = `${retals.map(retal => retal.attackId).join(',')}|${itemRequests.map(request => request.requestId).join(',')}|${chainDanger}|${turtleDanger}`;
        if (active && signature !== lastAlertSignature && settings.alertSound) playAlertTone();
        lastAlertSignature = active ? signature : '';
        if (fullUi) context.ui.getContentElement()?.closest('.window')?.classList.toggle('slink-war-alerting', active && settings.alertPanelFlash);
        context.ui.setAlertCount('war', retals.length + itemRequests.length, { group:'combat', label:'active War alerts' });
        context.ui.setBubbleAlert(retals.length ? 'retal' : itemRequests.length ? 'armory' : '', retals.length || itemRequests.length, 'war');
        setPageAlert(active);
      }

      async function renderHybridAlerts() {
        if (context.presentation !== 'headless') return;
        dismissedRetalMap = await dismissedRetals();
        const currentIds = new Set();
        for (const retal of visibleRetals()) {
          const id = String(retal.attackId);
          currentIds.add(id);
          if (dismissedRetalMap[retalDismissKey(retal)] || dismissedRetalMap[id] || shownAlerts.has(id)) continue;
          shownAlerts.add(id);
          const faction = retal.attackerFactionName || (retal.attackerFactionId ? `Faction ${retal.attackerFactionId}` : 'No faction');
          const flags = [retal.isWar ? 'War hit' : '', retal.isRetal ? 'Retal hit' : ''].filter(Boolean).join(' • ');
          context.ui.showAlert({
            id:`war-retal-${id}`,
            title:'SLINK Retaliation',
            subtitle:`${retal.attackerName || `Player ${retal.attackerId}`} / ${duration(Number(retal.expiresAt) - Math.floor(Date.now() / 1000))}`,
            contentHtml:`<div><strong>${escape(retal.attackerName || `Player ${retal.attackerId}`)} [${retal.attackerId}]</strong></div><div>${escape(faction)}${retal.attackerFactionTag ? ` [${escape(retal.attackerFactionTag)}]` : ''}</div><div>${escape(flags || 'Retaliation available')}</div><div>Attacked: ${escape(retal.defenderName || `Player ${retal.defenderId}`)}${retal.defenderId ? ` [${retal.defenderId}]` : ''}</div><div>Status: ${escape(retal.attackerStatus || retal.attackerActivity || 'Unknown')}</div><div>Estimated BS: ${Number.isFinite(retal.battleStatsEstimate) ? SLINK.core.format.shortNumber(retal.battleStatsEstimate) : 'Unknown'} • FF: ${Number.isFinite(retal.fairFight) ? retal.fairFight.toFixed(2) : 'Unknown'}</div>`,
            actions:[{ label:'Retaliate', href:attackUrl(retal.attackerId) }, { label:'Profile', href:profileUrl(retal.attackerId) }],
            onDismiss:async () => {
              dismissedRetalMap[retalDismissKey(retal)] = Number(retal.expiresAt) || Math.floor(Date.now() / 1000) + 300;
              await SLINK.core.storage.set('war.dismissedRetals.v1', dismissedRetalMap);
              evaluateAlerts();
            }
          });
        }
        for (const id of [...shownAlerts]) {
          if (!currentIds.has(id)) {
            context.ui.dismissAlert(`war-retal-${id}`);
            shownAlerts.delete(id);
          }
        }
        const requestIds = new Set();
        for (const request of current?.session?.officer ? (current?.runtime?.snapshot?.itemRequests || []) : []) {
          const id = String(request.requestId);
          requestIds.add(id);
          if (shownRequestAlerts.has(id)) continue;
          shownRequestAlerts.add(id);
          context.ui.showAlert({
            id:`war-armory-request-${id}`,
            title:'SLINK Armory Request',
            subtitle:`${request.bonusName || 'Ranked item'} requested by ${request.requesterName || `Player ${request.requesterId}`}`,
            contentHtml:`<div><strong>${escape(request.itemName || 'Ranked item')}</strong></div><div>Holder: ${escape(request.holderName || `Player ${request.holderId}`)} [${request.holderId}]</div><div>${escape(request.holderStatus || 'Unknown')} • ${escape(request.holderLastAction || 'Unknown')}</div>`,
            actions:[{ label:'Open armory', href:request.armoryUrl || 'https://www.torn.com/factions.php?step=your#/tab=armoury' }],
            onDismiss:async () => {
              await SLINK.core.messaging.send('war.armory.request', { operation:'resolve', requestId:id }).catch(() => {});
            }
          });
        }
        for (const id of [...shownRequestAlerts]) {
          if (!requestIds.has(id)) {
            context.ui.dismissAlert(`war-armory-request-${id}`);
            shownRequestAlerts.delete(id);
          }
        }
      }

      async function runCycle(force = false) {
        if (busy || stopped) return;
        busy = true;
        if (fullUi) render();
        try {
          current = await SLINK.core.messaging.send('war.status');
          if (force || leader) current = await SLINK.core.messaging.send('war.cycle.prepare', { manual:force });
          localError = '';
          await renderHybridAlerts();
          evaluateAlerts();
          renderInsideGateSurfaces();
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

      async function refreshLeader() {
        if (document.visibilityState !== 'visible') {
          if (leader) void SLINK.core.messaging.send('war.leader.release', { clientId:leaderClientId }).catch(() => {});
          leader = false;
          return false;
        }
        try {
          const result = await SLINK.core.messaging.send('war.leader.claim', { clientId:leaderClientId });
          leader = result?.leader === true;
        } catch { leader = false; }
        return leader;
      }

      current = await SLINK.core.messaging.send('war.status');
      dismissedRetalMap = await dismissedRetals();
      activeTab = await SLINK.core.storage.get('ui.war.activeTab.v1', 'targets');
      const savedTargetFilters = await SLINK.core.storage.get('ui.war.targetFilters.v1', {});
      targetFilters = { ...targetFilters, ...savedTargetFilters };
      targetSort = savedTargetFilters.sort || targetSort;
      if (!['targets', 'outside', 'claims', 'armory', 'logs', 'settings'].includes(activeTab)) activeTab = 'targets';
      armoryMode = await SLINK.core.storage.get('war.armory.mode.v1', 'ranked-all');
      armoryWhitelist = new Set((await SLINK.core.storage.get('war.armory.whitelist.v1', [])).map(String));
      armoryRankOrder = (await SLINK.core.storage.get('war.armory.rankOrder.v1', [])).map(normalizeArmoryRank).filter(Boolean);
      const armoryCache = await SLINK.core.storage.get('war.armory.memberCache.v1', null);
      if (Array.isArray(armoryCache?.members)) {
        armoryMembers = sortArmoryMembers(armoryCache.members);
        armoryMembersSavedAt = Number(armoryCache.savedAt) || 0;
      }
      const storedInsideUnlock = await SLINK.core.storage.get('war.insideUnlock.v1', null);
      if (Number(storedInsideUnlock?.expiresAt) > Date.now()) {
        insideUnlockedTarget = Number(storedInsideUnlock.targetId) || 0;
        insideUnlockedUntil = Number(storedInsideUnlock.expiresAt) || 0;
      }
      if (await SLINK.core.storage.get('ui.war.requestedTab', '') === 'armory' && current?.session?.officer) {
        activeTab = 'armory';
        await SLINK.core.storage.remove('ui.war.requestedTab');
      }
      document.addEventListener('click', handleProfileAttack, true);
      document.addEventListener('click', handleRankTabClick, true);
      document.addEventListener('visibilitychange', refreshLeader);
      if (fullUi && !current.configured) activeTab = 'settings';
      await refreshLeader();
      leaderTimer = setInterval(() => void refreshLeader(), 5_000);
      armoryObserver = new MutationObserver(records => {
        renderProfileAttackGate();
        scanAttackMugResults();
        if (rankPanelIsVisible()) scheduleRankOrderCapture();
      });
      armoryObserver.observe(document.body, { childList:true, subtree:true });
      render();
      renderInsideGateSurfaces();
      scanAttackMugResults();
      void runCycle(false);
      return { stop() {
        stopped = true;
        clearTimeout(timer);
        clearTimeout(attackMugScanTimer);
        attackMugScanTimer = null;
        for (const timerId of armoryRankCaptureTimers) clearTimeout(timerId);
        armoryRankCaptureTimers = [];
        clearInterval(leaderTimer);
        armoryObserver?.disconnect();
        clearAttackPageGate();
        clearProfileAttackGate();
        pageStyleElement?.remove();
        pageStyleElement = null;
        context.ui.setBubbleAlert('', 0, 'war');
        context.ui.setAlertCount('war', 0);
        setPageAlert(false);
        document.removeEventListener('click', handleProfileAttack, true);
        document.removeEventListener('click', handleRankTabClick, true);
        document.removeEventListener('visibilitychange', refreshLeader);
        void SLINK.core.messaging.send('war.leader.release', { clientId:leaderClientId }).catch(() => {});
        for (const id of shownAlerts) context.ui.dismissAlert(`war-retal-${id}`);
        for (const id of shownRequestAlerts) context.ui.dismissAlert(`war-armory-request-${id}`);
      } };
    }
  });
})(globalThis);

