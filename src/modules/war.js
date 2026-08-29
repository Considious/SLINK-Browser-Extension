(function registerWar(global) {
  'use strict';

  const SLINK = global.SLINK_EXTENSION;
  const WAR = SLINK.core.war;
  const MODULE_STYLES = `
    .slink-war-subtabs { display:grid; grid-template-columns:repeat(auto-fit,minmax(58px,1fr)); gap:4px; }
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
    .slink-armory-enhanced { overflow-x:auto; }
    .slink-armory-enhanced ul.item-list { min-width:780px; }
    .slink-armory-enhanced ul.item-list > li { position:relative; display:flex !important; align-items:stretch !important; flex-wrap:wrap !important; min-width:780px; }
    .slink-armory-enhanced ul.item-list > li > .img-wrap { float:none !important; flex:0 0 62px !important; }
    .slink-armory-enhanced ul.item-list > li > .name { float:none !important; flex:1 1 118px !important; min-width:118px; }
    .slink-armory-enhanced ul.item-list > li > .options-wrap { position:absolute !important; left:62px; top:0; z-index:2; }
    .slink-armory-enhanced ul.item-list > li > .bonuses { float:none !important; flex:0 0 145px !important; width:145px !important; }
    .slink-armory-enhanced ul.item-list > li > .type { float:none !important; flex:0 0 70px !important; width:70px !important; }
    .slink-armory-enhanced ul.item-list > li > .loaned { float:none !important; flex:0 0 120px !important; width:120px !important; }
    .slink-armory-enhanced ul.item-list > li > .item-action { float:none !important; flex:0 0 112px !important; width:112px !important; }
    .slink-armory-enhanced ul.item-list > li > .slink-armory-request-cell { display:grid; align-content:center; gap:2px; flex:0 0 110px; width:110px; min-height:44px; padding:4px 6px; border-left:1px solid rgba(128,128,128,.35); color:inherit; text-align:left; }
    .slink-armory-request-status { overflow:hidden; font-size:11px; font-weight:700; text-overflow:ellipsis; white-space:nowrap; }
    .slink-armory-request-last { overflow:hidden; opacity:.75; font-size:10px; text-overflow:ellipsis; white-space:nowrap; }
    .slink-armory-request-button { min-height:24px; margin-top:2px; padding:2px 5px; border:1px solid #5781a6; border-radius:4px; background:#253f57; color:#eaf6ff; cursor:pointer; font:700 11px Arial,sans-serif; }
    .slink-armory-request-button:disabled { cursor:wait; opacity:.65; }
    .slink-armory-enhanced ul.item-list > li > .action-cont,
    .slink-armory-enhanced ul.item-list > li > .view-item-info { flex:1 0 100% !important; width:100% !important; }
    .slink-armory-enhanced ul.item-list > li > .clear { display:none !important; }
    .slink-armory-header { display:flex !important; align-items:stretch; min-width:780px; }
    .slink-armory-header > [data-slink-armory-heading="item"] { flex:1 1 180px !important; }
    .slink-armory-header > [data-slink-armory-heading="details"] { flex:0 0 145px !important; width:145px !important; }
    .slink-armory-header > [data-slink-armory-heading="type"] { flex:0 0 70px !important; width:70px !important; }
    .slink-armory-header > [data-slink-armory-heading="loaned"] { flex:0 0 120px !important; width:120px !important; }
    .slink-armory-header > [data-slink-armory-heading="action"] { flex:0 0 112px !important; width:112px !important; }
    .slink-armory-request-header { display:flex; align-items:center; flex:0 0 110px; width:110px; padding:0 6px; border-left:1px solid rgba(128,128,128,.35); font-weight:700; }
    .slink-armory-request-header-fallback { display:flex; justify-content:flex-end; min-width:780px; padding:5px 8px; border-bottom:1px solid rgba(128,128,128,.35); font-weight:700; }
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
      let armoryMode = 'ranked-all';
      let armoryWhitelist = new Set();
      let armoryMembers = [];
      let armoryMembersSavedAt = 0;
      let armoryStatus = 'Ready. Retrieval only runs after you press Retrieve Next.';
      let armoryState = 'normal';
      let armoryBusy = false;
      let armoryObserver = null;
      let armoryDecorateTimer = null;
      let pageStyleElement = null;
      let insideGateElement = null;
      let insideUnlockedTarget = 0;
      let insideUnlockedUntil = 0;
      let pendingRetalSend = null;
      let pendingRetalSendTimer = null;
      let dismissedRetalMap = {};
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
        return (current?.runtime?.snapshot?.retals || []).filter(retal => {
          const expiresAt = Number(retal.expiresAt) || now + 300;
          return expiresAt > now && !dismissedRetalMap[retalDismissKey(retal)] && !dismissedRetalMap[String(retal.attackId)];
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
          if (!member || Number(member.level) < 15) return null;
        }
        return borrower;
      }

      function armorySetStatus(message, state = 'normal') {
        armoryStatus = message; armoryState = state;
        if (fullUi) render();
      }

      async function ensureArmoryMembers(force = false) {
        const cached = await SLINK.core.storage.get('war.armory.memberCache.v1', null);
        if (!force && cached?.savedAt && Date.now() - Number(cached.savedAt) < 60_000 && Array.isArray(cached.members) && cached.members.length) {
          armoryMembers = cached.members;
          armoryMembersSavedAt = Number(cached.savedAt) || 0;
          return true;
        }
        if (!pageIsFocused()) { armorySetStatus('Focus this Torn tab before loading faction members.', 'error'); return false; }
        const result = await SLINK.core.messaging.send('war.armory.members', { force });
        armoryMembers = (result?.members || []).sort((a, b) => String(a.rank).localeCompare(String(b.rank)) || String(a.name).localeCompare(String(b.name)));
        armoryMembersSavedAt = Number(result?.fetchedAt) || Date.now();
        await SLINK.core.storage.set('war.armory.memberCache.v1', { savedAt:armoryMembersSavedAt, members:armoryMembers });
        return armoryMembers.length > 0;
      }

      function armoryBonus(row) {
        const bonus = row.querySelector('.bonuses li.bonus [class*="bonus-attachment-"]');
        if (!bonus) return '';
        const title = String(bonus.getAttribute('title') || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
        const known = ['Revitalize', 'Warlord'].find(name => title.toLowerCase().includes(name.toLowerCase()) || [...bonus.classList].some(value => value.toLowerCase().includes(name.toLowerCase())));
        return known || title.split(' ')[0] || 'Ranked';
      }

      function queueArmoryEnhancement() {
        clearTimeout(armoryDecorateTimer);
        armoryDecorateTimer = setTimeout(() => void enhanceArmoryRows(), 250);
      }

      function ensureArmoryHeader(tab, list) {
        if (tab.querySelector('.slink-armory-request-header,.slink-armory-request-header-fallback')) return;
        const expected = new Set(['item', 'details', 'type', 'loaned', 'action']);
        const actionLabels = [...tab.querySelectorAll('*')].filter(node =>
          !node.closest('ul.item-list') &&
          node.children.length === 0 &&
          node.textContent.trim().toLowerCase() === 'action'
        );
        for (const label of actionLabels) {
          let cell = label;
          while (cell.parentElement && cell.parentElement !== tab) {
            const siblings = [...cell.parentElement.children];
            const matches = siblings.map(node => node.textContent.trim().toLowerCase()).filter(text => expected.has(text));
            if (matches.length >= 4) {
              const header = cell.parentElement;
              header.classList.add('slink-armory-header');
              for (const sibling of siblings) {
                const heading = sibling.textContent.trim().toLowerCase();
                if (expected.has(heading)) sibling.dataset.slinkArmoryHeading = heading;
              }
              const requestHeader = document.createElement(cell.tagName);
              requestHeader.className = 'slink-armory-request-header';
              requestHeader.textContent = 'SLINK';
              cell.insertAdjacentElement('afterend', requestHeader);
              return;
            }
            cell = cell.parentElement;
          }
        }
        const fallback = document.createElement('div');
        fallback.className = 'slink-armory-request-header-fallback';
        fallback.textContent = 'SLINK status / request';
        list.insertAdjacentElement('beforebegin', fallback);
      }

      function clearArmoryEnhancements() {
        document.querySelectorAll('.slink-armory-request-cell,.slink-armory-request-header,.slink-armory-request-header-fallback').forEach(node => node.remove());
        for (const header of document.querySelectorAll('.slink-armory-header')) {
          header.classList.remove('slink-armory-header');
          for (const child of header.children) delete child.dataset.slinkArmoryHeading;
        }
        document.querySelectorAll('.slink-armory-enhanced').forEach(node => node.classList.remove('slink-armory-enhanced'));
      }

      async function enhanceArmoryRows() {
        const tab = activeArmoryTab();
        if (!tab || !current?.session?.authenticated) return;
        ensurePageStyles();
        tab.classList.add('slink-armory-enhanced');
        const list = tab.querySelector('ul.item-list');
        if (!list) return;
        ensureArmoryHeader(tab, list);
        try {
          if (!armoryMembers.length || Date.now() - armoryMembersSavedAt >= 60_000 || !armoryMembers.some(member => member.statusState || member.lastActionRelative)) {
            await ensureArmoryMembers(!armoryMembers.some(member => member.statusState || member.lastActionRelative));
          }
        } catch (error) {
          localError = `Armory status unavailable: ${SLINK.core.format.errorMessage(error)}`;
          if (fullUi) render();
          return;
        }
        const byMember = new Map(armoryMembers.map(member => [String(member.id), member]));
        for (const row of list.querySelectorAll(':scope > li')) {
          const bonusName = armoryBonus(row);
          const borrower = armoryBorrower(row);
          if (!bonusName || !borrower) continue;
          const member = byMember.get(String(borrower.id));
          let cell = row.querySelector(':scope > .slink-armory-request-cell');
          if (!cell) {
            cell = document.createElement('div');
            cell.className = 'slink-armory-request-cell';
            cell.setAttribute('role', 'cell');
            row.querySelector('.item-action')?.insertAdjacentElement('afterend', cell);
          }
          const requestable = /^(revitalize|warlord)$/i.test(bonusName);
          cell.replaceChildren();
          const status = document.createElement('span');
          status.className = 'slink-armory-request-status';
          status.textContent = member?.statusState || 'Unknown';
          status.title = member?.statusDescription || status.textContent;
          cell.append(status);
          const lastAction = document.createElement('span');
          lastAction.className = 'slink-armory-request-last';
          lastAction.textContent = member?.lastActionRelative || 'Last action unknown';
          lastAction.title = lastAction.textContent;
          cell.append(lastAction);
          if (requestable) {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'slink-armory-request-button';
            button.textContent = 'Request Item';
            button.title = `Request this ${bonusName} item from ${borrower.name}`;
            button.addEventListener('click', async () => {
              button.disabled = true;
              const itemName = row.querySelector('.name')?.textContent.trim() || 'ranked item';
              const armoryId = row.querySelector('.img-wrap')?.dataset.armoryid || '';
              try {
                await SLINK.core.messaging.send('war.armory.request', {
                  holderId:Number(borrower.id), holderName:borrower.name, itemName, bonusName, armoryId,
                  armoryUrl:location.href, holderStatus:member?.statusState || 'Unknown', holderLastAction:member?.lastActionRelative || 'Unknown'
                });
                button.textContent = 'Sent';
              } catch (error) {
                button.textContent = 'Failed';
                localError = SLINK.core.format.errorMessage(error);
                if (fullUi) render();
                setTimeout(() => { if (button.isConnected) { button.disabled = false; button.textContent = 'Request Item'; } }, 2500);
              }
            });
            cell.append(button);
          }
        }
      }

      async function retrieveArmoryItem() {
        if (armoryBusy) return;
        armoryBusy = true;
        try {
          if (!pageIsFocused()) throw new Error('Focus this Torn tab before retrieving an item.');
          const tab = activeArmoryTab();
          const kind = armoryTabKind(tab);
          if (!tab || !kind) throw new Error('Open the Weapons or Armor tab in Faction Armoury first.');
          if (armoryMode === 'proficience-15-plus' && !await ensureArmoryMembers()) return;
          if (!pageIsFocused()) throw new Error('The Torn tab lost focus. Nothing was retrieved.');
          for (const row of tab.querySelectorAll('ul.item-list > li')) {
            const borrower = armoryEligibility(row, kind);
            if (!borrower) continue;
            const item = row.querySelector('.name')?.textContent.trim() || 'item';
            const open = row.querySelector('.item-action [data-role="retrieve"].active');
            open.click();
            for (let attempt = 0; attempt < 20; attempt += 1) {
              await new Promise(resolve => setTimeout(resolve, 50));
              if (!pageIsFocused()) throw new Error('The Torn tab lost focus before confirmation. Nothing else was clicked.');
              const confirm = row.querySelector('.retrieve-cont .retrieve-yes');
              if (confirm && confirm.getClientRects().length) {
                confirm.click();
                armorySetStatus(`Retrieved one ${item} from ${borrower.name}.`, 'success');
                return;
              }
            }
            throw new Error('Torn did not display the retrieval confirmation.');
          }
          armorySetStatus('No eligible ranked items remain on this page.', 'success');
        } catch (error) { armorySetStatus(SLINK.core.format.errorMessage(error), 'error'); }
        finally { armoryBusy = false; }
      }

      function nextArmoryPage() {
        if (!pageIsFocused()) return armorySetStatus('Focus this Torn tab before changing pages.', 'error');
        const tab = activeArmoryTab();
        if (!tab) return armorySetStatus('Open the Weapons or Armor tab in Faction Armoury first.', 'error');
        const selectors = ['.gallery-wrapper.pagination a[href] > i.pagination-right','.pagination a[href] > i.pagination-right','.pagination a.next:not(.disabled)','.pagination .next:not(.disabled) a','a[aria-label="Next"]','a[title="Next"]','[data-page="next"]'];
        let next = null;
        for (const selector of selectors) {
          const found = tab.querySelector(selector) || document.querySelector(`#faction-armoury ${selector}`);
          const control = found?.matches('a,button') ? found : found?.closest('a,button');
          if (control && !control.classList.contains('disabled') && !control.classList.contains('disable')) { next = control; break; }
        }
        if (!next) return armorySetStatus('No enabled Next Page control was found.', 'success');
        next.click();
        armorySetStatus('Moved to the next armory page.', 'success');
      }

      function armoryHtml() {
        if (!current?.session?.officer) return '<div class="slink-war-error">slink.war.officer permission is required.</div>';
        const onArmory = Boolean(activeArmoryTab());
        const members = armoryMembers.map(member => `<label class="slink-war-armory-member"><input type="checkbox" data-armory-member="${member.id}" ${armoryWhitelist.has(member.id) ? 'checked' : ''}><span><strong>${escape(member.name)}</strong><small>${escape(member.rank)} · level ${Number(member.level) || '?'} · ID ${member.id}</small></span></label>`).join('');
        return `<div class="slink-war-armory">
          <div class="slink-war-note">The Recaller only scans while this Torn tab is focused and retrieves exactly one item per click. It never runs automatically.</div>
          ${onArmory ? '' : '<a class="slink-war-note" href="https://www.torn.com/factions.php?step=your#/tab=armoury">Open Faction Armoury, then choose Weapons or Armor</a>'}
          <div class="slink-war-armory-controls"><label>Recall mode<select id="slink-armory-mode"><option value="ranked-all" ${armoryMode === 'ranked-all' ? 'selected' : ''}>All ranked items</option><option value="ranked-no-prof" ${armoryMode === 'ranked-no-prof' ? 'selected' : ''}>Ranked except Proficience</option><option value="proficience-15-plus" ${armoryMode === 'proficience-15-plus' ? 'selected' : ''}>Proficience from level 15+</option></select></label></div>
          <div class="slink-war-armory-actions"><button id="slink-armory-retrieve" type="button" ${onArmory && !armoryBusy ? '' : 'disabled'}>${armoryBusy ? 'Working…' : 'Retrieve Next'}</button><button id="slink-armory-next" type="button" ${onArmory ? '' : 'disabled'}>Next Page</button><button id="slink-armory-members" type="button">Load faction whitelist</button></div>
          <div class="slink-war-armory-status" data-state="${armoryState}">${escape(armoryStatus)}</div>
          ${armoryMembers.length ? `<details><summary>Never retrieve from (${armoryWhitelist.size})</summary><input id="slink-armory-search" class="slink-war-armory-search" type="search" placeholder="Search members"><div class="slink-war-armory-members">${members}</div></details>` : ''}
        </div>`;
      }

      function assignmentControls() {
        if (!current?.session?.officer) return '';
        return `<div class="slink-war-settings slink-war-note"><label>Assign claim to Torn ID<input id="slink-war-assignee-id" type="number" min="1" placeholder="Leave blank for yourself"></label><label>Member name<input id="slink-war-assignee-name" type="text" maxlength="80" placeholder="Optional"></label></div>`;
      }

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
        return `🚨 Retaliation: Please Hospitalize 🚨<br><a href="${profileUrl(retal.attackerId)}">${name} [${retal.attackerId}]</a> - <a href="${attackUrl(retal.attackerId)}">【ATTACK】</a> - (${escape(estimates.join(' | ') || 'Estimate unavailable')})${details.length ? `<br>${escape(details.join(' • '))}` : ''}`;
      }

      async function copyRetal(retal, button) {
        const message = retalCallout(retal);
        await navigator.clipboard.writeText(message);
        if (pendingRetalSendTimer) clearTimeout(pendingRetalSendTimer);
        pendingRetalSend = { attackId:String(retal.attackId), message, expiresAt:Date.now() + 30_000 };
        pendingRetalSendTimer = setTimeout(() => {
          pendingRetalSendTimer = null;
          pendingRetalSend = null;
          updateRetalSendButtons();
        }, 30_000);
        updateRetalSendButtons();
        const original = button.textContent; button.textContent = '✅ Copied';
        setTimeout(() => { if (button.isConnected) button.textContent = original; }, 1400);
      }

      function updateRetalSendButtons() {
        const root = fullUi ? context.ui.getContentElement() : null;
        if (!root) return;
        if (pendingRetalSend && pendingRetalSend.expiresAt <= Date.now()) pendingRetalSend = null;
        for (const button of root.querySelectorAll('[data-war-retal-send]')) {
          const enabled = Boolean(pendingRetalSend && pendingRetalSend.attackId === String(button.dataset.warRetalSend));
          button.disabled = !enabled;
          button.classList.toggle('slink-war-chat-authorized', enabled);
          button.title = enabled ? 'Send the copied callout to Faction Chat' : 'Press Copy first. Send remains available for 30 seconds.';
        }
      }

      function findFactionChatLauncher() {
        return [...document.querySelectorAll('button,a,[role="button"]')].find(node => {
          const label = [node.getAttribute?.('aria-label'), node.getAttribute?.('title'), node.textContent].filter(Boolean).join(' ').trim().toLowerCase();
          return label === 'faction' || label.includes('faction chat') || label.includes('open faction');
        }) || null;
      }

      function findFactionChatContainer() {
        const exact = [...document.querySelectorAll('[id^="faction-"]')].find(node => node.querySelector('textarea,[contenteditable="true"]'));
        if (exact) return exact;
        return [...document.querySelectorAll('div,section')].find(node => {
          const composer = node.querySelector('textarea,[contenteditable="true"]');
          const title = node.querySelector('button span,header span');
          return composer && String(title?.textContent || '').trim().toLowerCase() === 'faction';
        }) || null;
      }

      function setFactionComposerContent(composer, html) {
        composer.focus();
        if ('value' in composer) {
          const prototype = composer.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
          const setter = Object.getOwnPropertyDescriptor(prototype, 'value')?.set;
          if (setter) setter.call(composer, html); else composer.value = html;
        } else {
          composer.innerHTML = html;
        }
        try { composer.dispatchEvent(new InputEvent('input', { bubbles:true, composed:true, inputType:'insertText', data:html })); }
        catch { composer.dispatchEvent(new Event('input', { bubbles:true, composed:true })); }
        composer.dispatchEvent(new Event('change', { bubbles:true, composed:true }));
      }

      function findFactionChatSendButton(container, composer) {
        const buttons = [...(container || composer?.parentElement || document).querySelectorAll('button,[role="button"]')];
        return buttons.find(button => {
          const label = [button.getAttribute('aria-label'), button.getAttribute('title'), button.textContent].filter(Boolean).join(' ').trim().toLowerCase();
          return button.type === 'submit' || label === 'send' || label.includes('send message') || Boolean(button.querySelector('svg[viewBox="0 0 18 18"]'));
        }) || null;
      }

      async function waitForFactionComposer(timeoutMs = 2500) {
        const started = Date.now();
        while (Date.now() - started < timeoutMs) {
          const container = findFactionChatContainer();
          const composer = findFactionComposer();
          if (container && composer) return { container, composer };
          await new Promise(resolve => setTimeout(resolve, 100));
        }
        return { container:null, composer:null };
      }

      async function sendRetal(retal, button) {
        const authorization = pendingRetalSend;
        if (!authorization || authorization.attackId !== String(retal.attackId) || authorization.expiresAt <= Date.now()) {
          pendingRetalSend = null;
          updateRetalSendButtons();
          localError = 'Press Copy on this retaliation first. Send remains available for 30 seconds.';
          render();
          return;
        }
        if (!pageIsFocused()) {
          localError = 'Focus this Torn tab before sending to Faction Chat.';
          render();
          return;
        }
        const original = button.textContent;
        button.disabled = true;
        button.textContent = 'Sending…';
        try {
          let { container, composer } = await waitForFactionComposer(250);
          if (!container || !composer) {
            const launcher = findFactionChatLauncher();
            if (!launcher) throw new Error('Faction Chat could not be found. Open it and try again.');
            launcher.click();
            ({ container, composer } = await waitForFactionComposer());
          }
          if (!container || !composer) throw new Error('Faction Chat opened, but its message box could not be found.');
          setFactionComposerContent(composer, authorization.message);
          const sendButton = findFactionChatSendButton(container, composer);
          if (!sendButton) throw new Error('The Faction Chat send button could not be found.');
          const started = Date.now();
          while ((sendButton.disabled || sendButton.getAttribute('aria-disabled') === 'true') && Date.now() - started < 1500) {
            await new Promise(resolve => setTimeout(resolve, 50));
          }
          if (sendButton.disabled || sendButton.getAttribute('aria-disabled') === 'true') throw new Error('The callout was inserted, but Torn did not enable Send.');
          sendButton.click();
          pendingRetalSend = null;
          if (pendingRetalSendTimer) clearTimeout(pendingRetalSendTimer);
          pendingRetalSendTimer = null;
          button.textContent = '✓ Sent';
          localError = '';
        } catch (error) {
          button.textContent = 'Send failed';
          localError = SLINK.core.format.errorMessage(error);
        } finally {
          setTimeout(() => {
            if (button.isConnected) button.textContent = original;
            updateRetalSendButtons();
          }, 1400);
        }
      }

      function memberContext(member) {
        const known = new Set([member?.activity, member?.statusState].map(value => String(value || '').trim().toLowerCase()).filter(Boolean));
        const description = String(member?.statusDescription || '').trim();
        const details = [];
        if (description && !known.has(description.toLowerCase())) details.push(description);
        if (member?.lastActionRelative) details.push(member.lastActionRelative);
        return details.length ? `<span class="slink-war-context">${escape(details.join(' • '))}</span>` : '';
      }

      function targetCards() {
        const members = WAR.sortMembers(current?.runtime?.snapshot?.members || [], Date.now(), targetSort);
        if (!members.length) return '<div class="slink-war-empty">No eligible targets in the latest shared snapshot.</div>';
        return assignmentControls() + members.map(member => {
          const hospitalized = WAR.isHospitalized(member);
          const remaining = WAR.statusSeconds(member);
          const readyAt = hospitalized ? WAR.tctTime(member.statusUntil) : '';
          const claim = (current?.runtime?.snapshot?.claims || []).find(row => Number(row.targetId) === Number(member.id));
          const mine = Number(claim?.claimedById) === Number(current?.session?.userId);
          const gate = insideGate(member.id);
          return `<article class="slink-war-card" ${gate.active ? 'data-inside-blocked="true"' : ''}>
            <div class="slink-war-card-head"><a href="${profileUrl(member.id)}" target="_blank" rel="noopener noreferrer">${escape(member.name)} [${member.id}]</a><span>Lv ${member.level || '?'}</span></div>
            <div class="slink-war-meta"><span class="slink-war-pill ${member.activity === 'Online' ? 'slink-war-online' : ''}">${escape(member.activity || 'Unknown')}</span><span class="slink-war-pill ${hospitalized ? 'slink-war-hospital' : ''}">${escape(member.statusState || 'Okay')}${hospitalized ? ` ${duration(remaining)}${readyAt ? ` / ${readyAt} TCT` : ''}` : ''}</span><span class="slink-war-pill">Estimated BS ${Number.isFinite(member.battleStatsEstimate) ? SLINK.core.format.shortNumber(member.battleStatsEstimate) : '?'}</span><span class="slink-war-pill">FF ${Number.isFinite(member.fairFight) ? member.fairFight.toFixed(2) : '?'}</span>${memberContext(member)}</div>
            ${gate.active ? `<div class="slink-war-inside-disabled">${escape(insideGateMessage(gate))}</div>` : ''}
            <div class="slink-war-card-actions"><a href="${attackUrl(member.id)}" data-war-attack="${member.id}" target="_blank" rel="noopener noreferrer">${gate.active && gate.mode === 'block' ? 'INSIDES DISABLED' : 'Attack'}</a><a href="${profileUrl(member.id)}" target="_blank" rel="noopener noreferrer">Profile</a><button data-war-copy="${member.id}" type="button">Copy</button><button data-war-paste="${member.id}" type="button">Paste to faction chat</button><button data-war-claim="${member.id}" type="button" ${claim && !mine && !current?.session?.officer ? 'disabled' : ''}>${claim ? (mine ? 'Release claim' : `Claimed: ${escape(claim.claimedByName || claim.claimedById)}`) : 'Claim med-out'}</button></div>
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
          <div class="slink-war-card-actions"><a href="${attackUrl(member.id)}" data-war-attack="${member.id}" target="_blank" rel="noopener noreferrer">Attack</a><a href="${profileUrl(member.id)}" target="_blank" rel="noopener noreferrer">Profile</a><button data-war-copy="${member.id}" type="button">Copy</button><button data-war-paste="${member.id}" type="button">Paste to faction chat</button></div>
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
          <div class="slink-war-card-actions"><button data-war-retal-copy="${retal.attackId}" type="button">📋 Copy</button><button data-war-retal-send="${retal.attackId}" type="button" disabled title="Press Copy first. Send remains available for 30 seconds.">💬 Send</button><a class="slink-war-retal-attack" href="${attackUrl(retal.attackerId)}" data-war-attack="${retal.attackerId}" target="_blank" rel="noopener noreferrer">⚔ ATTACK</a><a href="${profileUrl(retal.attackerId)}" target="_blank" rel="noopener noreferrer">Profile</a></div>
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
        context.ui.setContentHtml(`<div class="slink-war-subtabs">${tabs.map(tab => `<button class="slink-war-subtab" data-war-tab="${tab}" aria-selected="${activeTab === tab}">${tab[0].toUpperCase()}${tab.slice(1)}</button>`).join('')}</div><div class="slink-war-summary"><div class="slink-war-stat"><b>${Number(stats.attacks) || 0}</b><span>Attacks</span></div><div class="slink-war-stat"><b>${Number(stats.warAttacks) || 0}${insideCap ? `/${insideCap}` : ''}</b><span>War / cap</span></div><div class="slink-war-stat"><b>${Number(stats.mugs) || 0}</b><span>Mugs</span></div><div class="slink-war-stat"><b>${chain}</b><span>Chain</span></div></div><div class="slink-war-note slink-war-report"><span>${mugSummary}</span><button id="slink-war-copy-report" type="button">Copy report</button></div>${itemRequestCards()}${retals.length ? `<div class="slink-war-note"><strong>Active retals</strong>${retalCards()}</div>` : ''}${localError ? `<div class="slink-war-error">${escape(localError)}</div>` : ''}<div>${body}</div>`);
        bindEvents();
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
        root.querySelector('#slink-armory-members')?.addEventListener('click', async event => {
          event.currentTarget.disabled = true;
          try { if (await ensureArmoryMembers()) armorySetStatus(`Loaded ${armoryMembers.length} faction members.`, 'success'); }
          catch (error) { armorySetStatus(SLINK.core.format.errorMessage(error), 'error'); }
        });
        for (const input of root.querySelectorAll('[data-armory-member]')) input.addEventListener('change', async () => {
          if (input.checked) armoryWhitelist.add(input.dataset.armoryMember); else armoryWhitelist.delete(input.dataset.armoryMember);
          await SLINK.core.storage.set('war.armory.whitelist.v1', [...armoryWhitelist]);
        });
        root.querySelector('#slink-armory-search')?.addEventListener('input', event => {
          const needle = event.currentTarget.value.trim().toLowerCase();
          for (const row of root.querySelectorAll('.slink-war-armory-member')) row.hidden = !row.textContent.toLowerCase().includes(needle);
        });
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
        for (const button of root.querySelectorAll('[data-war-copy]')) button.addEventListener('click', () => void copyCallout(members.get(Number(button.dataset.warCopy)), button).catch(error => { localError=SLINK.core.format.errorMessage(error); render(); }));
        for (const button of root.querySelectorAll('[data-war-paste]')) button.addEventListener('click', () => pasteCallout(members.get(Number(button.dataset.warPaste)), button));
        for (const button of root.querySelectorAll('[data-war-retal-copy]')) button.addEventListener('click', () => void copyRetal(retals.get(String(button.dataset.warRetalCopy)), button).catch(error => { localError=SLINK.core.format.errorMessage(error); render(); }));
        for (const button of root.querySelectorAll('[data-war-retal-send]')) button.addEventListener('click', () => void sendRetal(retals.get(String(button.dataset.warRetalSend)), button));
        for (const button of root.querySelectorAll('[data-war-retal-dismiss]')) button.addEventListener('click', () => void dismissRetal(retals.get(String(button.dataset.warRetalDismiss))));
        for (const link of root.querySelectorAll('[data-war-attack]')) link.addEventListener('click', event => void handleAttackLink(event, Number(link.dataset.warAttack)));
        for (const button of root.querySelectorAll('[data-armory-request-resolve]')) button.addEventListener('click', async () => {
          try {
            current = await SLINK.core.messaging.send('war.armory.request', { operation:'resolve', requestId:button.dataset.armoryRequestResolve });
            localError = '';
            render();
          } catch (error) { localError=SLINK.core.format.errorMessage(error); render(); }
        });
        for (const button of root.querySelectorAll('[data-war-claim]')) button.addEventListener('click', async () => {
          const member = members.get(Number(button.dataset.warClaim));
          const claim = (current?.runtime?.snapshot?.claims || []).find(row => Number(row.targetId) === Number(member?.id));
          try {
            const assigneeId = current?.session?.officer ? Number(root.querySelector('#slink-war-assignee-id')?.value) || 0 : 0;
            const assigning = Boolean(assigneeId);
            current = await SLINK.core.messaging.send('war.claims.update', {
              operation:claim && !assigning ? 'release' : 'claim',
              targetId:member.id,
              targetName:member.name,
              assigneeId,
              assigneeName:assigning ? String(root.querySelector('#slink-war-assignee-name')?.value || '').trim() : ''
            });
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
        updateRetalSendButtons();
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
        context.ui.setBubbleAlert(retals.length ? 'retal' : itemRequests.length ? 'armory' : '', retals.length || itemRequests.length);
        setPageAlert(active);
      }

      async function renderHybridAlerts() {
        if (context.presentation !== 'headless') return;
        dismissedRetalMap = await dismissedRetals();
        const currentIds = new Set();
        for (const retal of current?.runtime?.snapshot?.retals || []) {
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
          queueArmoryEnhancement();
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
      if (!['targets', 'outside', 'claims', 'armory', 'logs', 'settings'].includes(activeTab)) activeTab = 'targets';
      armoryMode = await SLINK.core.storage.get('war.armory.mode.v1', 'ranked-all');
      armoryWhitelist = new Set((await SLINK.core.storage.get('war.armory.whitelist.v1', [])).map(String));
      const armoryCache = await SLINK.core.storage.get('war.armory.memberCache.v1', null);
      if (Array.isArray(armoryCache?.members)) {
        armoryMembers = armoryCache.members;
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
      document.addEventListener('pointerdown', unlockAudio, { passive:true });
      document.addEventListener('click', handleProfileAttack, true);
      document.addEventListener('visibilitychange', refreshLeader);
      if (fullUi && !current.configured) activeTab = 'settings';
      await refreshLeader();
      leaderTimer = setInterval(() => void refreshLeader(), 5_000);
      armoryObserver = new MutationObserver(records => {
        renderProfileAttackGate();
        if (activeArmoryTab() && records.some(record => !record.target?.closest?.('.slink-armory-request-cell,.slink-armory-request-header'))) queueArmoryEnhancement();
      });
      armoryObserver.observe(document.body, { childList:true, subtree:true });
      render();
      renderInsideGateSurfaces();
      queueArmoryEnhancement();
      void runCycle(false);
      return { stop() {
        stopped = true;
        clearTimeout(timer);
        clearTimeout(armoryDecorateTimer);
        clearInterval(leaderTimer);
        if (pendingRetalSendTimer) clearTimeout(pendingRetalSendTimer);
        pendingRetalSendTimer = null;
        pendingRetalSend = null;
        armoryObserver?.disconnect();
        clearArmoryEnhancements();
        clearAttackPageGate();
        clearProfileAttackGate();
        pageStyleElement?.remove();
        pageStyleElement = null;
        context.ui.setBubbleAlert('', 0);
        setPageAlert(false);
        document.removeEventListener('pointerdown', unlockAudio);
        document.removeEventListener('click', handleProfileAttack, true);
        document.removeEventListener('visibilitychange', refreshLeader);
        void SLINK.core.messaging.send('war.leader.release', { clientId:leaderClientId }).catch(() => {});
        for (const id of shownAlerts) context.ui.dismissAlert(`war-retal-${id}`);
        for (const id of shownRequestAlerts) context.ui.dismissAlert(`war-armory-request-${id}`);
      } };
    }
  });
})(globalThis);
