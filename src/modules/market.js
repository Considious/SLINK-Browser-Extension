(function registerMarketModule(global) {
  'use strict';

  const SLINK = global.SLINK_EXTENSION;
  if (!SLINK) throw new Error('SLINK runtime must load before Market Watch.');
  const escapeHtml = value => SLINK.core.format.escapeHtml(value ?? '');

  function relativeTime(timestamp) {
    if (!Number(timestamp)) return 'not checked yet';
    const seconds = Math.max(0, Math.floor((Date.now() - Number(timestamp)) / 1000));
    return seconds < 60 ? `${seconds}s ago` : seconds < 3600 ? `${Math.floor(seconds / 60)}m ago` : `${Math.floor(seconds / 3600)}h ago`;
  }

  SLINK.modules.register({
    id:'market',
    title:'SLINK Market Watch',
    shortTitle:'Market',
    group:'efficiency',
    groupTitle:'Efficiency',
    permissionTest:permissions => SLINK.core.adhd.marketWatchLimit(permissions) > 0,
    defaultShowInTorn:true,
    matches:url => url.hostname === 'www.torn.com',
    async start(context) {
      const ui = context.ui;
      let stopped = false;
      let current = null;
      let timer = null;
      let clockTimer = null;
      let observer = null;
      let formatTimer = null;
      let shareArm = null;
      let quickBuyLayer = null;
      let quickBuyPositionFrame = null;
      const quickBuyControls = new Map();

      ui.setModuleStyles(`
        .slink-market-summary{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:5px}.slink-market-summary>div{padding:7px;border:1px solid var(--slink-border-soft);border-radius:7px;background:var(--slink-bg-control);text-align:center}.slink-market-summary strong,.slink-market-summary small{display:block}.slink-market-summary small{color:var(--slink-muted)}
        .slink-market-list{display:grid;gap:7px}.slink-market-deal{padding:8px;border:1px solid var(--slink-border-soft);border-left:4px solid var(--slink-ready);border-radius:7px;background:var(--slink-bg-control)}.slink-market-deal strong,.slink-market-deal span{display:block}.slink-market-deal span{margin-top:2px;color:var(--slink-muted)}
        .slink-market-actions{display:flex;flex-wrap:wrap;gap:5px;margin-top:7px}.slink-market-actions a,.slink-market-actions button{display:inline-flex;align-items:center;justify-content:center;min-height:28px;padding:4px 8px;border:1px solid var(--slink-border);border-radius:6px;background:var(--slink-bg);color:var(--slink-text);font:inherit;text-decoration:none;cursor:pointer}.slink-market-actions button:disabled{opacity:.45;cursor:not-allowed}.slink-market-empty{padding:16px;border-radius:7px;background:var(--slink-bg-control);color:var(--slink-muted);text-align:center}
      `);

      function focusedTornPage() {
        return document.visibilityState === 'visible' && document.hasFocus();
      }

      function copyText(text) {
        if (navigator.clipboard?.writeText) return navigator.clipboard.writeText(text).then(() => true, () => false);
        const textarea = document.createElement('textarea');
        textarea.value = text; textarea.style.cssText = 'position:fixed;left:-9999px;top:-9999px';
        document.body.append(textarea); textarea.select();
        const copied = document.execCommand('copy'); textarea.remove();
        return Promise.resolve(copied);
      }

      function factionContainer() {
        const exact = [...document.querySelectorAll('[id^="faction-"]')].find(node => node.querySelector('textarea[placeholder="Type your message here..."],textarea[class*="textarea"]'));
        if (exact) return exact;
        return [...document.querySelectorAll('div,section')].find(node => {
          const composer = node.querySelector('textarea[placeholder*="message" i],[contenteditable="true"]');
          const title = node.querySelector('button span,header span');
          return composer && String(title?.textContent || '').trim().toLowerCase() === 'faction';
        }) || null;
      }

      function factionLauncher() {
        return [...document.querySelectorAll('button,a,[role="button"]')].find(node => {
          const label = [node.getAttribute?.('aria-label'), node.getAttribute?.('title'), node.textContent].filter(Boolean).join(' ').trim().toLowerCase();
          return label === 'faction' || label.includes('faction chat') || label.includes('open faction');
        }) || null;
      }

      function composer(container) {
        return container?.querySelector('textarea[placeholder="Type your message here..."],textarea[class*="textarea"],textarea,[contenteditable="true"]') || null;
      }

      function setComposer(node, text) {
        node.focus();
        if (node.matches('textarea,input')) {
          const prototype = node.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
          const setter = Object.getOwnPropertyDescriptor(prototype, 'value')?.set;
          if (setter) setter.call(node, text); else node.value = text;
        } else {
          node.innerHTML = '';
          try { document.execCommand('insertHTML', false, text); } catch { node.innerHTML = text; }
        }
        node.dispatchEvent(new Event('input', { bubbles:true, composed:true }));
        node.dispatchEvent(new Event('change', { bubbles:true, composed:true }));
      }

      async function waitFor(check, timeoutMs = 2000) {
        const started = Date.now();
        while (Date.now() - started < timeoutMs) {
          const result = check(); if (result) return result;
          await new Promise(resolve => global.setTimeout(resolve, 75));
        }
        return null;
      }

      async function sendToFaction(text) {
        if (!focusedTornPage()) return false;
        let container = factionContainer(); let input = composer(container);
        if (!input) {
          const launcher = factionLauncher(); if (!launcher) return false;
          launcher.click();
          const found = await waitFor(() => { const next = factionContainer(); const field = composer(next); return field ? { next, field } : null; });
          container = found?.next; input = found?.field;
        }
        if (!input || !focusedTornPage()) return false;
        setComposer(input, text);
        const send = await waitFor(() => [...(container?.querySelectorAll('button,[role="button"]') || [])].find(button => {
          const label = [button.getAttribute('aria-label'), button.getAttribute('title'), button.textContent].filter(Boolean).join(' ').toLowerCase();
          return !button.disabled && (button.type === 'submit' || label.trim() === 'send' || label.includes('send message'));
        }), 1500);
        if (!send || !focusedTornPage()) return false;
        send.click(); return true;
      }

      function purchasePage() {
        const url = new URL(location.href);
        const joined = `${url.search}&${url.hash}`;
        const itemId = Number(joined.match(/(?:itemID|itemId)=(\d+)/i)?.[1] || url.searchParams.get('itemId')) || 0;
        const price = Number(joined.match(/slinkPrice=(\d+)/i)?.[1] || url.searchParams.get('price')) || 0;
        const bazaar = url.pathname.toLowerCase().endsWith('/bazaar.php');
        const market = String(url.searchParams.get('sid') || '').toLowerCase() === 'itemmarket'
          || /itemmarket/i.test(url.pathname)
          || /(?:^|\/)itemmarket(?:\/|$)/i.test(url.hash.replace(/^#\/?/, ''));
        if (!bazaar && !market) return null;
        const linked = itemId > 0 && price > 0 && (market || url.searchParams.get('slinkHighlight') === '1');
        return { itemId, price, bazaar, market, linked };
      }

      function nodePrice(node) {
        const preferred = node.querySelector('[data-testid="price"],[class*="price___"]');
        const text = String(preferred?.textContent || node.textContent || '');
        const match = text.match(/\$\s*([\d,]+(?:\.\d+)?)/) || text.match(/^\s*([\d,]+(?:\.\d+)?)/);
        return match ? Number(match[1].replaceAll(',', '')) : 0;
      }

      function nodeItemId(node) {
        const declared = Number(node?.dataset?.itemId || node?.getAttribute?.('data-item-id')) || 0;
        if (declared > 0) return Math.trunc(declared);
        const image = node.querySelector('img[src*="/images/items/"],img[srcset*="/images/items/"]');
        const imageId = Number(`${image?.getAttribute?.('src') || ''} ${image?.getAttribute?.('srcset') || ''}`.match(/\/images\/items\/(\d+)\//i)?.[1]) || 0;
        if (imageId > 0) return imageId;
        const href = node.querySelector('a[href*="itemID=" i],a[href*="itemId=" i]')?.getAttribute('href') || '';
        return Number(href.match(/(?:itemID|itemId)=(\d+)/i)?.[1]) || 0;
      }

      function pageItemId(page) {
        if (page.itemId > 0) return page.itemId;
        const main = document.querySelector('#mainContainer,#main-container,[data-testid="main-content"],main[role="main"],main');
        const ids = [...new Set([...(main?.querySelectorAll('img[src*="/images/items/"],img[srcset*="/images/items/"]') || [])]
          .map(image => Number(`${image.getAttribute('src') || ''} ${image.getAttribute('srcset') || ''}`.match(/\/images\/items\/(\d+)\//i)?.[1]) || 0)
          .filter(Boolean))];
        return ids.length === 1 ? ids[0] : 0;
      }

      function purchaseNodes(page) {
        if (page.bazaar) {
          const container = document.querySelector('[data-testid="bazaar-items"]');
          if (!container) return [];
          const direct = [...container.querySelectorAll('[data-testid="item"]')];
          if (direct.length) return direct;
          return [...new Set([...container.querySelectorAll('img[src*="/images/items/"],img[srcset*="/images/items/"]')]
            .map(image => image.closest('[class*="item___"],article,li'))
            .filter(Boolean))];
        }
        const rows = [...document.querySelectorAll('ul[class*="sellerList___"] li[class*="rowWrapper___"],[data-testid="seller-row"],[data-testid="market-listing"]')]
          .filter(node => node.querySelector('[class*="sellerRow___"],[class*="price___"],[data-testid="price"]'));
        if (rows.length) return [...new Set(rows)];
        return [...new Set([...document.querySelectorAll('button[class*="buyButton___"],button[aria-label^="Buy "]')]
          .map(button => button.closest('li,article,[class*="rowWrapper___"]'))
          .filter(Boolean))];
      }

      function nodeName(node) {
        const image = node.querySelector('img[src*="/images/items/"],img[srcset*="/images/items/"]');
        return String(node.querySelector('[data-testid="name"]')?.textContent || image?.getAttribute('alt') || '').replace(/\s+/g, ' ').trim().toLowerCase();
      }

      function catalogItem(node, page) {
        const items = Array.isArray(current?.catalog?.items) ? current.catalog.items : [];
        const itemId = nodeItemId(node) || pageItemId(page);
        if (itemId > 0) return items.find(item => Number(item.id) === itemId) || null;
        const name = nodeName(node);
        return name ? items.find(item => String(item.name || '').trim().toLowerCase() === name) || null : null;
      }

      function nodeUnavailable(node) {
        if (node.matches('[aria-disabled="true"],[data-disabled="true"],[class*="disabled" i],[class*="unavailable" i],[class*="soldOut" i]')
          || node.querySelector('[class*="isBlockedForBuying"],#isBlockedForBuyingTooltip')) return true;
        if (/\b(?:cannot buy|can't buy|unavailable|sold out|purchase limit|buy limit)\b/i.test(String(node.textContent || ''))) return true;
        const controls = [...node.querySelectorAll('button,[role="button"]')].filter(button => !button.matches('[data-slink-market-buy]')
          && (/\b(?:buy|purchase)\b/i.test(`${button.textContent || ''} ${button.getAttribute('aria-label') || ''}`)
            || button.matches('[class*="buyButton___"],[class*="controlPanelButton___"]')));
        return controls.length > 0 && !controls.some(button => !button.disabled && button.getAttribute('aria-disabled') !== 'true');
      }

      function fillMaximum(node, price) {
        const input = node.querySelector('input[data-testid="legacy-money-input"]:not([type="hidden"]),input.input-money:not([type="hidden"]),input[type="number"]');
        if (!input || input.disabled || input.readOnly) return;
        const dataStock = Number(String(input.dataset?.money || '').replace(/[^\d]/g, '')) || 0;
        const textStock = Number(String(node.textContent || '').match(/([\d,]+)\s+(?:available|in stock)/i)?.[1]?.replaceAll(',', '')) || 0;
        const stock = dataStock || textStock || Number(input.max) || 1;
        const money = Number(String(document.querySelector('#user-money')?.dataset?.money || '').replace(/[^\d]/g, '')) || Number.POSITIVE_INFINITY;
        const maximum = Math.max(1, Math.min(stock, Number.isFinite(money) && price > 0 ? Math.floor(money / price) : stock));
        const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
        if (setter) setter.call(input, String(maximum)); else input.value = String(maximum);
        input.dispatchEvent(new Event('input', { bubbles:true })); input.dispatchEvent(new Event('change', { bubbles:true }));
      }

      function ensureQuickBuyLayer() {
        if (quickBuyLayer?.isConnected) return quickBuyLayer;
        quickBuyLayer = document.createElement('div');
        quickBuyLayer.dataset.slinkMarketBuyLayer = 'true';
        quickBuyLayer.setAttribute('aria-label', 'SLINK highlighted listing buy controls');
        quickBuyLayer.style.cssText = 'position:fixed;inset:0;z-index:2147483646;pointer-events:none';
        document.body.appendChild(quickBuyLayer);
        return quickBuyLayer;
      }

      function positionQuickBuy(button, native) {
        if (!button?.isConnected || !native?.isConnected) return;
        const rect = native.getBoundingClientRect();
        const hidden = rect.width <= 0 || rect.height <= 0 || rect.right < 0 || rect.bottom < 0 || rect.left > innerWidth || rect.top > innerHeight;
        button.style.display = hidden ? 'none' : 'flex';
        if (hidden) return;
        button.style.left = `${Math.round(rect.left * 10) / 10}px`;
        button.style.top = `${Math.round(rect.top * 10) / 10}px`;
        button.style.width = `${Math.round(rect.width * 10) / 10}px`;
        button.style.height = `${Math.round(rect.height * 10) / 10}px`;
      }

      function syncQuickBuyPositions() {
        if (quickBuyPositionFrame) return;
        quickBuyPositionFrame = global.requestAnimationFrame(() => {
          quickBuyPositionFrame = null;
          quickBuyControls.forEach((spec, native) => positionQuickBuy(spec.button, native));
        });
      }

      function removeQuickBuy(native) {
        const spec = quickBuyControls.get(native);
        spec?.button?.remove();
        native?.removeAttribute?.('data-slink-market-buy-native');
        quickBuyControls.delete(native);
        if (!quickBuyControls.size) { quickBuyLayer?.remove(); quickBuyLayer = null; }
      }

      function clearQuickBuys() {
        [...quickBuyControls.keys()].forEach(removeQuickBuy);
        document.querySelectorAll('[data-slink-market-buy]').forEach(button => button.remove());
        document.querySelectorAll('[data-slink-market-buy-native]').forEach(native => native.removeAttribute('data-slink-market-buy-native'));
        quickBuyLayer?.remove(); quickBuyLayer = null;
      }

      function installQuickBuy(node, target) {
        if (!current?.settings?.quickBuyEnabled) return null;
        const native = [...node.querySelectorAll('button,[role="button"]')].find(button => !button.disabled && button.getAttribute('aria-disabled') !== 'true'
          && !button.matches('[data-slink-market-buy]')
          && (/\b(?:buy|purchase)\b/i.test(`${button.textContent || ''} ${button.getAttribute('aria-label') || ''} ${button.getAttribute('title') || ''}`)
            || button.matches('[class*="buyButton___"],[class*="controlPanelButton___"]')));
        if (!native) return null;
        const existing = quickBuyControls.get(native);
        if (existing) {
          existing.node = node; existing.target = target;
          positionQuickBuy(existing.button, native);
          return native;
        }
        const button = document.createElement('button');
        button.type = 'button'; button.dataset.slinkMarketBuy = 'true'; button.textContent = 'SLINK Buy';
        button.setAttribute('aria-label', 'SLINK Buy maximum available quantity');
        button.title = 'SLINK Buy maximum available quantity';
        button.style.cssText = 'position:fixed;box-sizing:border-box;display:flex;align-items:center;justify-content:center;margin:0;padding:0 3px;border:1px solid rgba(255,255,255,.32);border-radius:4px;background:linear-gradient(#b9ff68,#68c51d);box-shadow:inset 0 1px rgba(255,255,255,.48),0 0 7px rgba(112,255,40,.55);color:#111;font:700 10px/1.1 Arial,sans-serif;text-align:center;text-transform:uppercase;overflow:hidden;cursor:pointer;pointer-events:auto';
        button.addEventListener('click', event => {
          if (!event.isTrusted || !focusedTornPage()) return;
          event.preventDefault(); event.stopImmediatePropagation();
          const spec = quickBuyControls.get(native);
          if (!spec || !native.isConnected || native.disabled || native.getAttribute('aria-disabled') === 'true') return;
          fillMaximum(spec.node, spec.target.price); native.click();
          [40, 160, 450].forEach(delay => global.setTimeout(scheduleFormat, delay));
        });
        native.dataset.slinkMarketBuyNative = 'true';
        ensureQuickBuyLayer().appendChild(button);
        quickBuyControls.set(native, { button, node, target });
        positionQuickBuy(button, native);
        return native;
      }

      function formatPurchasePage() {
        if (stopped) return;
        const page = purchasePage();
        const cleanup = node => {
          node.removeAttribute('data-slink-market-highlight');
          node.removeAttribute('data-slink-market-targeted');
          node.removeAttribute('data-slink-market-shop-profit');
          node.removeAttribute('data-slink-market-one-dollar');
          node.removeAttribute('data-slink-market-reason');
          node.style.removeProperty('outline');
          node.style.removeProperty('outline-offset');
          node.style.removeProperty('box-shadow');
          quickBuyControls.forEach((spec, native) => { if (spec.node === node) removeQuickBuy(native); });
        };
        if (!page) {
          document.querySelectorAll('[data-slink-market-highlight]').forEach(cleanup);
          clearQuickBuys();
          return;
        }
        const nodes = purchaseNodes(page);
        const matched = new Set();
        const activeQuickBuys = new Set();
        for (const node of nodes) {
          const price = nodePrice(node);
          const itemId = nodeItemId(node) || pageItemId(page);
          const item = catalogItem(node, page);
          const itemMatches = page.itemId <= 0 || itemId <= 0 || itemId === page.itemId;
          const targeted = page.linked && itemMatches && price === page.price;
          const state = SLINK.core.market.listingHighlightState({ price, shopSellPrice:item?.shopSellPrice, targeted, available:!nodeUnavailable(node) });
          if (!state.highlighted) { if (node.hasAttribute('data-slink-market-highlight')) cleanup(node); continue; }
          matched.add(node);
          node.dataset.slinkMarketHighlight = state.targeted ? 'targeted' : state.shopProfit ? 'shop-profit' : 'one-dollar';
          node.toggleAttribute('data-slink-market-targeted', state.targeted);
          node.toggleAttribute('data-slink-market-shop-profit', state.shopProfit);
          node.toggleAttribute('data-slink-market-one-dollar', state.oneDollar);
          const color = state.targeted || state.oneDollar ? '#39ff14' : '#ff4fbd';
          const glow = state.targeted || state.oneDollar ? 'rgba(57,255,20,.72)' : 'rgba(255,79,189,.68)';
          node.style.setProperty('outline', `4px solid ${color}`, 'important');
          node.style.setProperty('outline-offset', '2px', 'important');
          node.style.setProperty('box-shadow', `0 0 18px 5px ${glow}`, 'important');
          node.dataset.slinkMarketReason = state.targeted ? 'SLINK API-matched listing' : state.shopProfit ? `Below city shop sell price${item?.shopSellPrice ? ` ($${Number(item.shopSellPrice).toLocaleString()})` : ''}` : '$1 purchase opportunity';
          if (current?.settings?.quickBuyEnabled && !nodeUnavailable(node)) {
            const native = installQuickBuy(node, { price });
            if (native) activeQuickBuys.add(native);
          } else {
            quickBuyControls.forEach((spec, native) => { if (spec.node === node) removeQuickBuy(native); });
          }
        }
        document.querySelectorAll('[data-slink-market-highlight]').forEach(node => { if (!matched.has(node)) cleanup(node); });
        quickBuyControls.forEach((_spec, native) => { if (!activeQuickBuys.has(native)) removeQuickBuy(native); });
      }

      function scheduleFormat() {
        if (formatTimer) return;
        formatTimer = global.setTimeout(() => { formatTimer = null; formatPurchasePage(); }, 80);
      }

      function aggregateShare(opportunities) {
        return opportunities.slice(0, 12).map(row => row.shareText).join('\n');
      }

      function updateShareButtons(root) {
        const armed = shareArm && shareArm.expiresAt > Date.now() ? shareArm : null;
        if (!armed) shareArm = null;
        const all = root.querySelector('[data-market-send-all]');
        if (all) all.disabled = armed?.id !== 'all';
        root.querySelectorAll('[data-market-send]').forEach(button => {
          button.disabled = armed?.id !== button.dataset.marketSend;
          button.title = button.disabled ? 'Copy this listing first to unlock sending' : 'Send this listing to Faction Chat';
        });
      }

      function updateStatus() {
        if (!current) return;
        ui.setStatus(current.lastError || (current.permitted ? `API watches updated ${relativeTime(current.fetchedAt)}` : 'A Market Watch permission tier is required.'), current.lastError ? 'error' : current.permitted ? 'ready' : 'normal');
      }

      function updateApiUsage(event) {
        if (!current || !event?.detail) return;
        current.tornApiUsage = event.detail;
        const element = ui.getContentElement().querySelector('[data-slink-api-usage]');
        if (element) element.textContent = `${event.detail.count || 0}/${event.detail.limit || 60}`;
      }

      function render(status) {
        current = status;
        updateStatus();
        const deals = Array.isArray(status?.opportunities) ? status.opportunities : [];
        ui.setAlertCount('market', deals.length, { group:'efficiency', label:'active Market Watch deals' });
        const root = ui.getContentElement();
        root.innerHTML = `<div class="slink-market-summary"><div><strong>${status?.settings?.watches?.length || 0}/${status?.marketWatchLimit || 0}</strong><small>Watches</small></div><div><strong>${deals.length}</strong><small>Deals</small></div><div><strong data-slink-api-usage>${status?.tornApiUsage?.count || 0}/${status?.tornApiUsage?.limit || 60}</strong><small>API / min</small></div></div>
          <div class="slink-market-actions"><button type="button" data-market-copy-all ${deals.length ? '' : 'disabled'}>Copy item list</button><button type="button" data-market-send-all disabled>Send list to Faction</button></div>
          <div class="slink-market-list">${deals.length ? deals.map(row => `<article class="slink-market-deal"><strong>${escapeHtml(row.source)} · ${escapeHtml(row.itemName)}</strong><span>${escapeHtml(row.detail)}</span><div class="slink-market-actions"><a href="${escapeHtml(row.href)}" target="_self">Open &amp; highlight</a><button type="button" data-market-copy="${escapeHtml(row.id)}">Copy</button><button type="button" data-market-send="${escapeHtml(row.id)}" disabled>Send to Faction</button><button type="button" data-market-dismiss="${escapeHtml(row.id)}">Dismiss 5m</button></div></article>`).join('') : '<div class="slink-market-empty">No watched listing is currently at or below its target.</div>'}</div>`;
        const copyAll = root.querySelector('[data-market-copy-all]');
        const sendAll = root.querySelector('[data-market-send-all]');
        copyAll?.addEventListener('click', async () => {
          const text = aggregateShare(deals); const copied = await copyText(text);
          copyAll.textContent = copied ? 'List copied' : 'Copy failed';
          if (copied) { shareArm = { id:'all', text, expiresAt:Date.now() + 120_000 }; updateShareButtons(root); }
        });
        sendAll?.addEventListener('click', async () => {
          if (!shareArm || shareArm.id !== 'all' || shareArm.expiresAt <= Date.now()) { updateShareButtons(root); return; }
          sendAll.disabled = true; sendAll.textContent = 'Sending…';
          const sent = await sendToFaction(shareArm.text); sendAll.textContent = sent ? 'Sent to Faction' : 'Open/focus Faction Chat';
          if (sent) shareArm = null;
          updateShareButtons(root);
        });
        root.querySelectorAll('[data-market-copy]').forEach(button => button.addEventListener('click', async () => {
          const row = deals.find(item => item.id === button.dataset.marketCopy);
          const copied = Boolean(row) && await copyText(row.shareText);
          button.textContent = copied ? 'Copied' : 'Copy failed';
          if (copied) shareArm = { id:row.id, text:row.shareText, expiresAt:Date.now() + 120_000 };
          updateShareButtons(root);
        }));
        root.querySelectorAll('[data-market-send]').forEach(button => button.addEventListener('click', async () => {
          const row = deals.find(item => item.id === button.dataset.marketSend);
          if (!row || shareArm?.id !== row.id || shareArm.expiresAt <= Date.now()) { updateShareButtons(root); return; }
          button.disabled = true; button.textContent = 'Sending…';
          const sent = await sendToFaction(shareArm.text);
          button.textContent = sent ? 'Sent to Faction' : 'Open/focus Faction Chat';
          if (sent) shareArm = null;
          updateShareButtons(root);
        }));
        root.querySelectorAll('[data-market-dismiss]').forEach(button => button.addEventListener('click', async () => {
          const row = deals.find(item => item.id === button.dataset.marketDismiss);
          if (!row) return;
          button.disabled = true; button.textContent = 'Dismissing…';
          render(await SLINK.core.messaging.send('market.deal.dismiss', { dismissKey:row.dismissKey }));
        }));
        updateShareButtons(root);
        scheduleFormat();
      }

      async function load(refreshIfDue = true) {
        try { render(await SLINK.core.messaging.send('market.status', { refreshIfDue })); }
        catch (error) { ui.setStatus(SLINK.core.format.errorMessage(error), 'error'); }
      }

      ui.setActions([
        { id:'refresh', label:'Refresh', onClick:async event => { event.currentTarget.disabled = true; try { render(await SLINK.core.messaging.send('market.refresh')); } catch (error) { ui.setStatus(SLINK.core.format.errorMessage(error), 'error'); } finally { event.currentTarget.disabled = false; } } },
        { id:'permissions', label:'Refresh permissions', onClick:async event => { event.currentTarget.disabled = true; try { render(await SLINK.core.messaging.send('market.permissions.refresh')); } catch (error) { ui.setStatus(SLINK.core.format.errorMessage(error), 'error'); } finally { event.currentTarget.disabled = false; } } },
        { id:'settings', label:'Settings', onClick:() => SLINK.core.messaging.send('ui.dashboard.open', { page:'alerts', efficiencyView:'market' }) }
      ]);
      observer = new MutationObserver(scheduleFormat);
      observer.observe(document.body, { childList:true, subtree:true });
      global.addEventListener('hashchange', scheduleFormat);
      global.addEventListener('popstate', scheduleFormat);
      global.addEventListener('resize', syncQuickBuyPositions);
      global.addEventListener('scroll', syncQuickBuyPositions, true);
      await load(true);
      global.addEventListener('slink:api-usage', updateApiUsage);
      timer = global.setInterval(() => { if (!stopped) void load(true); }, 15_000);
      clockTimer = global.setInterval(() => { if (!stopped) updateStatus(); }, 1_000);
      return { stop() { stopped = true; observer?.disconnect(); if (timer) global.clearInterval(timer); if (clockTimer) global.clearInterval(clockTimer); if (formatTimer) global.clearTimeout(formatTimer); if (quickBuyPositionFrame) global.cancelAnimationFrame(quickBuyPositionFrame); global.removeEventListener('slink:api-usage', updateApiUsage); global.removeEventListener('hashchange', scheduleFormat); global.removeEventListener('popstate', scheduleFormat); global.removeEventListener('resize', syncQuickBuyPositions); global.removeEventListener('scroll', syncQuickBuyPositions, true); ui.setAlertCount('market', 0); clearQuickBuys(); document.querySelectorAll('[data-slink-market-highlight]').forEach(node => { node.removeAttribute('data-slink-market-highlight'); node.removeAttribute('data-slink-market-targeted'); node.removeAttribute('data-slink-market-shop-profit'); node.removeAttribute('data-slink-market-one-dollar'); node.removeAttribute('data-slink-market-reason'); node.style.removeProperty('outline'); node.style.removeProperty('outline-offset'); node.style.removeProperty('box-shadow'); }); } };
    }
  });
})(globalThis);
