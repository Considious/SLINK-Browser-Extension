(function registerEventsModule(global) {
  'use strict';

  const SLINK = global.SLINK_EXTENSION;
  if (!SLINK) throw new Error('SLINK runtime must load before Events.');
  const CORE = SLINK.core.events;
  const OVERLAY_ID = 'slink-halloween-upgrade-guide';
  const OVERLAY_STYLE_ID = 'slink-halloween-upgrade-guide-style';

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, character => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[character]));
  }

  function relativeTime(timestamp) {
    if (!Number(timestamp)) return 'not checked yet';
    const seconds = Math.max(0, Math.floor((Date.now() - Number(timestamp)) / 1000));
    return seconds < 60 ? `${seconds}s ago` : seconds < 3600 ? `${Math.floor(seconds / 60)}m ago` : `${Math.floor(seconds / 3600)}h ago`;
  }

  function dateTime(timestamp) {
    if (!Number(timestamp)) return 'Schedule not published';
    return new Intl.DateTimeFormat(undefined, {
      timeZone:'UTC', year:'numeric', month:'short', day:'numeric', hour:'2-digit', minute:'2-digit', hour12:false
    }).format(new Date(Number(timestamp))) + ' TCT';
  }

  function countdown(timestamp) {
    if (!Number(timestamp)) return '';
    const ms = Number(timestamp) - Date.now();
    if (ms <= 0) return 'Now';
    const days = Math.floor(ms / 86_400_000);
    const hours = Math.floor((ms % 86_400_000) / 3_600_000);
    const minutes = Math.ceil((ms % 3_600_000) / 60_000);
    return days ? `${days}d ${hours}h` : hours ? `${hours}h ${minutes}m` : `${minutes}m`;
  }

  function readHalloweenBasketDom() {
    const basketNameNode = [...document.querySelectorAll('span.name,.name')]
      .find(node => /Halloween Basket/i.test(String(node.textContent || '')));
    const wrapper = document.querySelector('.updates-grid-slides-wrapper');
    if (!basketNameNode || !wrapper) return null;
    const upgrades = [...wrapper.querySelectorAll('.basket-update[data-basket-action="upgrade"][data-upgradeid]')].map(button => ({
      upgradeId:Number(button.dataset.upgradeid),
      name:button.querySelector('.update-name')?.textContent || '',
      unlocked:button.classList.contains('unlocked'),
      disabled:Boolean(button.disabled || button.closest('.updates-grid-slide')?.classList.contains('disabled'))
    }));
    return { wrapper, rank:CORE.halloweenBasketRank(basketNameNode.textContent), upgrades };
  }

  function ensureOverlayStyle() {
    if (document.getElementById(OVERLAY_STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = OVERLAY_STYLE_ID;
    style.textContent = `
      #${OVERLAY_ID}{margin:10px 0;padding:11px;border:2px solid #ff8a00;border-radius:9px;background:#17120d;color:#f5f5f5;box-shadow:0 2px 10px #0008;font:12px/1.4 Arial,sans-serif}
      #${OVERLAY_ID} .slink-halloween-head{display:flex;align-items:start;justify-content:space-between;gap:9px;flex-wrap:wrap}
      #${OVERLAY_ID} h3{margin:0;color:#ffb347;font-size:14px}#${OVERLAY_ID} p{margin:4px 0 0;color:#ccc}
      #${OVERLAY_ID} ol{display:grid;gap:6px;margin:9px 0 0;padding:0;list-style:none}
      #${OVERLAY_ID} li{display:grid;grid-template-columns:30px minmax(0,1fr) auto;gap:7px;align-items:center;padding:7px;border:1px solid #555;border-radius:7px;background:#24201b}
      #${OVERLAY_ID} li[data-current="true"]{border-color:#ff8a00;box-shadow:inset 3px 0 #ff8a00}
      #${OVERLAY_ID} li[data-disabled="true"]{opacity:.8}#${OVERLAY_ID} .slink-step{font-weight:900;color:#ffb347}
      #${OVERLAY_ID} small{display:block;color:#aaa}#${OVERLAY_ID} .slink-state{font-weight:700;color:#9ee493;text-align:right}
      #${OVERLAY_ID} li[data-disabled="true"] .slink-state{color:#ffd166}
    `;
    (document.head || document.documentElement).append(style);
  }

  SLINK.modules.register({
    id:'events',
    title:'Events',
    shortTitle:'Events',
    group:'quality-of-life',
    groupTitle:'Quality of Life',
    requiredScopes:[CORE.SCOPE],
    defaultShowInTorn:true,
    matches:url => url.hostname === 'www.torn.com',
    async start(context) {
      const ui = context.ui;
      const root = ui.getContentElement();
      let data = null;
      let busy = false;
      let notice = '';
      let stopped = false;
      let basketObserver = null;
      let basketScanTimer = null;
      let basketSignature = '';

      ui.setModuleStyles(`
        .slink-events{display:grid;gap:10px}.slink-event-card{min-width:0;padding:11px;border:1px solid var(--slink-border-soft);border-radius:9px;background:var(--slink-bg-control)}
        .slink-event-head,.slink-event-actions{display:flex;align-items:flex-start;justify-content:space-between;gap:9px;flex-wrap:wrap}.slink-event-head>div{min-width:0;flex:1}.slink-event-head strong,.slink-event-head small{display:block}.slink-event-head small{margin-top:3px;color:var(--slink-muted);line-height:1.35}
        .slink-event-picker{display:grid;gap:5px;margin-top:9px}.slink-event-picker select{width:100%;min-height:42px}
        .slink-event-stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:7px;margin-top:9px}
        .slink-event-stat{min-width:0;padding:8px;border:1px solid var(--slink-border-soft);border-radius:7px}.slink-event-stat strong,.slink-event-stat small{display:block}.slink-event-stat strong{overflow-wrap:anywhere}.slink-event-stat small{margin-top:3px;color:var(--slink-muted);line-height:1.3}
        .slink-event-status{text-transform:capitalize}.slink-event-progress{border-left:3px solid var(--slink-warning)}
        .slink-halloween-path{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:5px;margin:8px 0}.slink-halloween-path div{padding:6px;border:1px solid var(--slink-border-soft);border-radius:6px}.slink-halloween-path b{color:var(--slink-accent)}
        .slink-relic-list{display:grid;gap:5px;margin-top:7px}.slink-relic-list div{padding:6px;border-left:3px solid var(--slink-accent);background:var(--slink-bg)}.slink-relic-list strong,.slink-relic-list small{display:block}.slink-relic-list small{color:var(--slink-muted)}
        @media(max-width:620px){.slink-event-stats,.slink-halloween-path{grid-template-columns:1fr}}
      `);

      function halloweenGuideCard() {
        return `<article class="slink-event-card slink-event-progress"><div class="slink-event-head"><div><strong>Halloween basket guide</strong><small>Exact tested progression from the linked community guide</small></div><a href="${CORE.HALLOWEEN_GUIDE_URL}">Open guide</a></div>
          <div class="slink-halloween-path">${CORE.HALLOWEEN_UPGRADE_ORDER.map(upgrade => `<div><b>${upgrade.step}.</b> ${escapeHtml(upgrade.name)}${upgrade.optional ? ' <small>Optional</small>' : ''}</div>`).join('')}</div>
          <p><strong>Normal path skips:</strong> ${CORE.HALLOWEEN_SKIPPED_UPGRADES.map(upgrade => escapeHtml(upgrade.name)).join(', ')}. Mortal Coil, Inflation, and Summon Him belong to the separate M'aol path.</p>
          <p>On the basket page, SLINK reads Torn's actual unlocked classes and overlays the next three guide steps. A merely selected upgrade never counts as unlocked.</p>
          <div class="slink-relic-list">${CORE.HALLOWEEN_RELICS.map(relic => `<div><strong>${escapeHtml(relic.name)}</strong><small>${escapeHtml(relic.effect)}</small></div>`).join('')}</div>
        </article>`;
      }

      function render() {
        const calendar = data?.calendar;
        const selected = data?.selected;
        if (!calendar?.events?.length || !selected) {
          root.innerHTML = `<div class="slink-events"><article class="slink-event-card"><div class="slink-event-head"><div><strong>Torn Events</strong><small>Official Torn calendar data with personal start times when available.</small></div><button type="button" data-events-refresh>${busy ? 'Checking…' : 'Refresh'}</button></div><p>${escapeHtml(data?.lastError || 'Refresh to load Torn’s current event calendar.')}</p></article></div>`;
          return;
        }
        root.innerHTML = `<div class="slink-events">
          <article class="slink-event-card"><div class="slink-event-head"><div><strong>Torn Events</strong><small>Updated ${relativeTime(data.fetchedAt)} · every published event plus year-round preparation guides</small></div><button type="button" data-events-refresh>${busy ? 'Checking…' : 'Refresh'}</button></div>
            ${data.lastError ? `<p>${escapeHtml(data.lastError)}</p>` : ''}${notice ? `<p>${escapeHtml(notice)}</p>` : ''}
            <label class="slink-event-picker">Choose event<select data-events-select>${calendar.events.map(event => `<option value="${escapeHtml(event.id)}" ${event.id === selected.id ? 'selected' : ''}>${escapeHtml(event.name)} · ${event.guideOnly ? 'guide available year-round' : escapeHtml(event.state === 'unscheduled' ? 'schedule not published' : event.state)}</option>`).join('')}</select></label>
          </article>
          <article class="slink-event-card"><div class="slink-event-head"><div><strong>${escapeHtml(selected.name)}</strong><small class="slink-event-status">${escapeHtml(selected.state)}${selected.personalized ? ' · personalized Torn start time' : ''}</small></div><a href="${CORE.CALENDAR_URL}">Open Torn calendar</a></div>
            <div class="slink-event-stats"><div class="slink-event-stat"><strong>${escapeHtml(dateTime(selected.startAt))}</strong><small>Starts${selected.startAt > Date.now() ? ' · ' + escapeHtml(countdown(selected.startAt)) : ''}</small></div><div class="slink-event-stat"><strong>${escapeHtml(dateTime(selected.endAt))}</strong><small>Ends</small></div><div class="slink-event-stat"><strong>${calendar.events.filter(event => !event.guideOnly).length}</strong><small>Events currently published</small></div></div>
            ${selected.description ? `<p>${escapeHtml(selected.description)}</p>` : ''}
          </article>
          ${CORE.isHalloweenEvent(selected) ? halloweenGuideCard() : '<article class="slink-event-card slink-event-progress"><strong>Event guide in progress</strong><p>Event-specific preparation and SLINK best practices will be added here without guessing at unfinished guidance.</p></article>'}
        </div>`;
      }

      function renderBasketOverlay(snapshot) {
        const guide = CORE.halloweenRecommendations(snapshot.upgrades, 3);
        const signature = JSON.stringify([snapshot.rank, snapshot.upgrades.map(item => [item.upgradeId,item.unlocked,item.disabled])]);
        if (signature === basketSignature && document.getElementById(OVERLAY_ID)) return;
        basketSignature = signature;
        ensureOverlayStyle();
        let overlay = document.getElementById(OVERLAY_ID);
        if (!overlay) {
          overlay = document.createElement('section');
          overlay.id = OVERLAY_ID;
          snapshot.wrapper.parentElement?.insertBefore(overlay, snapshot.wrapper);
        }
        overlay.innerHTML = `<div class="slink-halloween-head"><div><h3>SLINK Halloween Upgrade Guide</h3><p>${escapeHtml(snapshot.rank || 'Halloween Basket')} · ${guide.completedCount}/${guide.total} guide steps complete</p></div><a href="${CORE.HALLOWEEN_GUIDE_URL}">Full guide</a></div>${guide.complete ? '<p><strong>Normal guide path complete.</strong></p>' : `<ol>${guide.recommendations.map(upgrade => `<li data-current="${String(upgrade.current)}" data-disabled="${String(upgrade.disabled)}"><span class="slink-step">#${upgrade.step}</span><span><strong>${escapeHtml(upgrade.name)}</strong><small>${upgrade.cost.toLocaleString()} treats${upgrade.note ? ' · ' + escapeHtml(upgrade.note) : ''}</small></span><span class="slink-state">${upgrade.disabled ? 'Locked—evolve basket' : upgrade.current ? 'Next' : 'Then'}</span></li>`).join('')}</ol>`}`;
      }

      function onHalloweenBasketPage() {
        return /\/item(?:s)?\.php$/i.test(global.location.pathname);
      }

      function scanBasket() {
        if (stopped) return;
        if (!onHalloweenBasketPage()) {
          document.getElementById(OVERLAY_ID)?.remove();
          basketSignature = '';
          return;
        }
        const snapshot = readHalloweenBasketDom();
        if (!snapshot) {
          document.getElementById(OVERLAY_ID)?.remove();
          basketSignature = '';
          return;
        }
        renderBasketOverlay(snapshot);
      }

      function scheduleBasketScan(delay = 80) {
        if (stopped || basketScanTimer) return;
        basketScanTimer = global.setTimeout(() => { basketScanTimer = null; scanBasket(); }, delay);
      }

      async function load(force = false) {
        if (busy) return;
        busy = true; notice = ''; render();
        try {
          data = await SLINK.core.messaging.send(force ? 'events.refresh' : 'events.status', { refreshIfDue:true });
          ui.setStatus(data.lastError || 'Torn event calendar ready.', data.lastError ? 'error' : 'ready');
        } catch (error) {
          notice = SLINK.core.format.errorMessage(error);
          ui.setStatus(notice, 'error');
        } finally { busy = false; render(); }
      }

      root.addEventListener('click', event => {
        if (event.target.closest('[data-events-refresh]')) void load(true);
      });

      root.addEventListener('change', async event => {
        const select = event.target.closest('[data-events-select]');
        if (!select) return;
        select.disabled = true;
        try {
          data = await SLINK.core.messaging.send('events.selection.save', { id:select.value });
          notice = '';
        } catch (error) { notice = SLINK.core.format.errorMessage(error); }
        render();
      });

      basketObserver = new MutationObserver(mutations => {
        if (!onHalloweenBasketPage()) return;
        if (mutations.every(mutation => mutation.target?.closest?.(`#${OVERLAY_ID},#slink-extension-panel`))) return;
        scheduleBasketScan();
      });
      basketObserver.observe(document.body, { childList:true, subtree:true, characterData:true, attributes:true, attributeFilter:['class','disabled'] });
      global.addEventListener('hashchange', scheduleBasketScan);
      global.addEventListener('popstate', scheduleBasketScan);
      scheduleBasketScan(0);

      await load(false);
      return {
        stop() {
          stopped = true;
          basketObserver?.disconnect();
          if (basketScanTimer) global.clearTimeout(basketScanTimer);
          global.removeEventListener('hashchange', scheduleBasketScan);
          global.removeEventListener('popstate', scheduleBasketScan);
          document.getElementById(OVERLAY_ID)?.remove();
          document.getElementById(OVERLAY_STYLE_ID)?.remove();
        }
      };
    }
  });
})(globalThis);

