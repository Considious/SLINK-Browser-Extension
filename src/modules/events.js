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
    const basket = [...document.querySelectorAll('.use-halloween-basket')].find(basketVisible);
    const container = basket?.querySelector('.item-cont');
    const grid = container?.querySelector('.updates-grid');
    const wrapper = grid?.querySelector('.updates-grid-slides-wrapper');
    const basketNameNode = basket?.closest('li[data-item]')?.querySelector('span.name,.name');
    if (!basketNameNode || !container || !grid || !wrapper) return null;
    const upgrades = [...wrapper.querySelectorAll('.basket-update[data-basket-action="upgrade"][data-upgradeid]')].map(button => ({
      upgradeId:Number(button.dataset.upgradeid),
      name:button.querySelector('.update-name')?.textContent || '',
      unlocked:button.classList.contains('unlocked'),
      disabled:Boolean(button.disabled || button.closest('.updates-grid-slide')?.classList.contains('disabled'))
    }));
    return { basket, container, grid, wrapper, rank:CORE.halloweenBasketRank(basketNameNode.textContent), upgrades };
  }

  function basketVisible(element) {
    return Boolean(element?.isConnected && element.getClientRects().length && global.getComputedStyle(element).visibility !== 'hidden');
  }

  function ensureOverlayStyle() {
    if (document.getElementById(OVERLAY_STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = OVERLAY_STYLE_ID;
    style.textContent = `
      #${OVERLAY_ID}{position:relative!important;inset:auto!important;display:block;clear:both;box-sizing:border-box;min-width:0;max-width:100%;margin:6px 0;padding:7px 9px;border:1px solid #ff8a00;border-radius:7px;background:#17120d;color:#f5f5f5;font:12px/1.35 Arial,sans-serif}
      #${OVERLAY_ID} .slink-halloween-head{display:flex;align-items:start;justify-content:space-between;gap:9px;flex-wrap:wrap}
      #${OVERLAY_ID} h3{margin:0;color:#ffb347;font-size:13px}#${OVERLAY_ID} p{margin:2px 0 0;color:#ccc}
      #${OVERLAY_ID} .slink-halloween-actions{display:flex;align-items:center;gap:10px;flex-wrap:wrap}#${OVERLAY_ID} .slink-halloween-actions a{color:#8dd4ff}#${OVERLAY_ID} button{min-height:30px;padding:3px 8px;border:1px solid #777;border-radius:5px;background:#29231b;color:#eee;font:inherit;cursor:pointer}
      #${OVERLAY_ID} ol{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(190px,100%),1fr));gap:5px;margin:6px 0 0;padding:0;list-style:none}
      #${OVERLAY_ID} li{display:grid;grid-template-columns:24px minmax(0,1fr);gap:5px;align-items:start;padding:5px;border:1px solid #555;border-radius:5px;background:#24201b;min-width:0}
      #${OVERLAY_ID} li[data-current="true"]{border-color:#ff8a00;box-shadow:inset 3px 0 #ff8a00}
      #${OVERLAY_ID} li[data-disabled="true"]{opacity:.8}#${OVERLAY_ID} .slink-step{font-weight:900;color:#ffb347}
      #${OVERLAY_ID} small{display:block;color:#aaa}#${OVERLAY_ID} .slink-state{display:block;font-size:11px;font-weight:700;color:#9ee493}
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
      let activeBasket = null;
      let helperHidden = false;

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
          <p>On the basket page, SLINK reads Torn's actual unlocked classes and shows the next three guide steps below the treats bar. A merely selected upgrade never counts as unlocked.</p>
          <div class="slink-relic-list">${CORE.HALLOWEEN_RELICS.map(relic => `<div><strong>${escapeHtml(relic.name)}</strong><small>${escapeHtml(relic.effect)}</small></div>`).join('')}</div>
        </article>`;
      }

      function render() {
        if (stopped || context.signal?.aborted) return;
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
        if (helperHidden) return;
        const guide = CORE.halloweenRecommendations(snapshot.upgrades, 3);
        const signature = JSON.stringify([snapshot.rank, snapshot.upgrades.map(item => [item.upgradeId,item.unlocked,item.disabled])]);
        if (signature === basketSignature && document.getElementById(OVERLAY_ID)) return;
        basketSignature = signature;
        ensureOverlayStyle();
        let overlay = document.getElementById(OVERLAY_ID);
        if (!overlay) {
          overlay = document.createElement('section');
          overlay.id = OVERLAY_ID;
          overlay.addEventListener('click', event => {
            if (!event.target.closest('[data-slink-hide-helper]')) return;
            event.preventDefault();
            event.stopPropagation();
            helperHidden = true;
            overlay.remove();
          });
        }
        if (overlay.parentElement !== snapshot.container || overlay.nextElementSibling !== snapshot.grid) snapshot.container.insertBefore(overlay, snapshot.grid);
        overlay.innerHTML = `<div class="slink-halloween-head"><div><h3>SLINK Halloween Guide</h3><p>${escapeHtml(snapshot.rank || 'Halloween Basket')} · ${guide.completedCount}/${guide.total} complete</p></div><div class="slink-halloween-actions"><a href="${CORE.HALLOWEEN_GUIDE_URL}">Full guide</a><button type="button" data-slink-hide-helper>Hide helper</button></div></div>${guide.complete ? '<p><strong>Normal guide path complete.</strong></p>' : `<ol>${guide.recommendations.map(upgrade => `<li data-current="${String(upgrade.current)}" data-disabled="${String(upgrade.disabled)}"><span class="slink-step">#${upgrade.step}</span><span><strong>${escapeHtml(upgrade.name)}</strong><small>${upgrade.cost.toLocaleString()} treats${upgrade.note ? ' · ' + escapeHtml(upgrade.note) : ''}</small><span class="slink-state">${upgrade.disabled ? 'Locked—evolve basket' : upgrade.current ? 'Next' : 'Then'}</span></span></li>`).join('')}</ol>`}`;
      }

      function resetBasketSession() {
        document.getElementById(OVERLAY_ID)?.remove();
        basketSignature = '';
        activeBasket = null;
        helperHidden = false;
      }

      function onHalloweenBasketPage() {
        return /\/item(?:s)?\.php$/i.test(global.location.pathname);
      }

      function scanBasket() {
        if (stopped || context.isActive?.() === false || document.hidden) return;
        if (!onHalloweenBasketPage()) {
          resetBasketSession();
          return;
        }
        const snapshot = readHalloweenBasketDom();
        if (!snapshot) {
          resetBasketSession();
          return;
        }
        if (snapshot.basket !== activeBasket) {
          resetBasketSession();
          activeBasket = snapshot.basket;
        }
        renderBasketOverlay(snapshot);
      }

      function scheduleBasketScan(delay = 80) {
        if (stopped || basketScanTimer || context.isActive?.() === false || document.hidden) return;
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

      context.listen(root, 'click', event => {
        if (event.target.closest('[data-events-refresh]')) void load(true);
      });

      context.listen(root, 'change', async event => {
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
        if (context.isActive?.() === false || document.hidden) return;
        if (!onHalloweenBasketPage()) return;
        if (activeBasket && !basketVisible(activeBasket)) resetBasketSession();
        if (mutations.every(mutation => mutation.target?.closest?.(`#${OVERLAY_ID},#slink-extension-panel`))) return;
        scheduleBasketScan();
      });
      basketObserver.observe(document.body, { childList:true, subtree:true, characterData:true, attributes:true, attributeFilter:['class','disabled','style','hidden','aria-hidden','aria-expanded'] });
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

