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
      let quickPurchaseFlow = null;
      let pendingBazaarPurchase = null;
      let quickPurchaseSyncTimer = null;
      let quickPurchaseListingIdCounter = 0;
      let pendingSoundClaim = null;
      const quickBuyControls = new Map();
      const quickPurchaseControlSpecs = new WeakMap();
      const quickPurchaseListingIds = new WeakMap();
      const QUICK_PURCHASE_TRANSITION_TIMEOUT_MS = 2_500;
      const QUICK_PURCHASE_FLOW_TIMEOUT_MS = 10_000;

      ui.setModuleStyles(`
        .slink-market-summary{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:5px}.slink-market-summary>div{padding:7px;border:1px solid var(--slink-border-soft);border-radius:7px;background:var(--slink-bg-control);text-align:center}.slink-market-summary strong,.slink-market-summary small{display:block}.slink-market-summary small{color:var(--slink-muted)}
        .slink-market-list{display:grid;gap:7px}.slink-market-deal{padding:8px;border:1px solid var(--slink-border-soft);border-left:4px solid var(--slink-ready);border-radius:7px;background:var(--slink-bg-control)}.slink-market-deal strong,.slink-market-deal span{display:block}.slink-market-deal span{margin-top:2px;color:var(--slink-muted)}
        .slink-market-actions{display:flex;flex-wrap:wrap;gap:5px;margin-top:7px}.slink-market-actions a,.slink-market-actions button{display:inline-flex;align-items:center;justify-content:center;min-height:28px;padding:4px 8px;border:1px solid var(--slink-border);border-radius:6px;background:var(--slink-bg);color:var(--slink-text);font:inherit;text-decoration:none;cursor:pointer}.slink-market-actions button:disabled{opacity:.45;cursor:not-allowed}.slink-market-empty{padding:16px;border-radius:7px;background:var(--slink-bg-control);color:var(--slink-muted);text-align:center}
        .slink-market-sound{display:flex;align-items:center;gap:6px;color:var(--slink-text);font-size:12px}.slink-market-sound input{margin:0}
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

      async function playPendingSound() {
        if (!pendingSoundClaim) return false;
        const claim = pendingSoundClaim;
        await SLINK.core.adhd.playNotificationSound(claim);
        await SLINK.core.messaging.send('market.sound.ack', { dealKeys:claim.dealKeys || [] });
        if (pendingSoundClaim === claim) pendingSoundClaim = null;
        return true;
      }

      async function claimMarketSound() {
        try {
          const claim = await SLINK.core.messaging.send('market.sound.claim');
          if (claim?.play) pendingSoundClaim = claim;
          await playPendingSound();
        } catch {}
      }

      function unlockAndRetrySound(event) {
        if (!event.isTrusted) return;
        void SLINK.core.adhd.unlockNotificationSound().then(playPendingSound).catch(() => {});
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
        const itemId = nodeItemId(node) || pageItemId(purchasePage() || {});
        const main = document.querySelector('#mainContainer,#main-container,[data-testid="main-content"],main[role="main"],main');
        const pageImage = itemId > 0 ? main?.querySelector?.(`img[src*="/images/items/${itemId}/"],img[srcset*="/images/items/${itemId}/"]`) : null;
        return String(node.querySelector('[data-testid="name"]')?.textContent || image?.getAttribute('alt') || pageImage?.getAttribute('alt') || '').replace(/\s+/g, ' ').trim().toLowerCase();
      }

      function catalogItem(node, page) {
        const items = Array.isArray(current?.catalog?.items) ? current.catalog.items : [];
        const itemId = nodeItemId(node) || pageItemId(page);
        if (itemId > 0) return items.find(item => Number(item.id) === itemId) || null;
        const name = nodeName(node);
        return name ? items.find(item => String(item.name || '').trim().toLowerCase() === name) || null : null;
      }

      function cssColorLooksRed(value) {
        const match = String(value || '').match(/rgba?\(\s*(\d+(?:\.\d+)?)\D+(\d+(?:\.\d+)?)\D+(\d+(?:\.\d+)?)(?:\D+(\d+(?:\.\d+)?))?/i);
        if (!match || (match[4] != null && Number(match[4]) === 0)) return false;
        const [red, green, blue] = [Number(match[1]), Number(match[2]), Number(match[3])];
        return red >= 90 && green <= red * 0.65 && blue <= red * 0.8;
      }

      function elementVisible(element) {
        if (!element?.isConnected) return false;
        const style = getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        return style.display !== 'none' && style.visibility !== 'hidden' && Number(style.opacity) !== 0 && rect.width > 0 && rect.height > 0;
      }

      function nodeUnavailable(node, kind = '') {
        if (kind === 'item-market') {
          const input = node.querySelector('input[data-testid="legacy-money-input"]:not([type="hidden"]),input.input-money:not([type="hidden"])');
          const buy = [...node.querySelectorAll('button[class*="buyButton___"],button[aria-label^="Buy "]')].find(button => !button.matches('[data-slink-market-buy]'));
          const priceElement = node.querySelector('[class*="price___"]');
          if (!input || !buy || input.disabled || input.readOnly) return true;
          if (/\b(?:cannot buy|can't buy|unavailable|sold out|purchase limit|buy limit)\b/i.test(String(node.textContent || ''))) return true;
          const rowStyle = getComputedStyle(node); const priceStyle = priceElement ? getComputedStyle(priceElement) : null;
          return cssColorLooksRed(rowStyle.backgroundColor) || cssColorLooksRed(rowStyle.borderColor)
            || cssColorLooksRed(priceStyle?.color) || cssColorLooksRed(priceStyle?.backgroundColor);
        }
        if (node.matches('[aria-disabled="true"],[data-disabled="true"],[class*="disabled" i],[class*="unavailable" i],[class*="soldOut" i]')
          || node.querySelector('[class*="isBlockedForBuying"],#isBlockedForBuyingTooltip')) return true;
        if (/\b(?:cannot buy|can't buy|unavailable|sold out|purchase limit|buy limit)\b/i.test(String(node.textContent || ''))) return true;
        const controls = [...node.querySelectorAll('button,[role="button"]')].filter(button => !button.matches('[data-slink-market-buy]')
          && (/\b(?:buy|purchase)\b/i.test(`${button.textContent || ''} ${button.getAttribute('aria-label') || ''}`)
            || button.matches('[class*="buyButton___"],[class*="controlPanelButton___"]')));
        return controls.length > 0 && !controls.some(button => !button.disabled && button.getAttribute('aria-disabled') !== 'true');
      }

      function bazaarQuantityInput(card) {
        const active = document.activeElement;
        if (active?.matches?.('[class*="buyAmountInput_"],input[type="number"],input[inputmode="numeric"]') && !active.disabled && !active.readOnly) return active;
        const roots = [card, ...[...document.querySelectorAll('[class*="buyMenu__"],[class*="buyForm___"],[role="dialog"],[aria-modal="true"],[class*="modal" i],[class*="dialog" i],[class*="confirm" i]')].filter(elementVisible)];
        for (const root of roots.filter(Boolean)) {
          const inputs = [...root.querySelectorAll('[class*="buyAmountInput_"],input[type="number"],input[inputmode="numeric"],input[pattern*="0-9"]')]
            .filter(input => !input.disabled && !input.readOnly && elementVisible(input));
          const labelled = inputs.find(input => /\b(?:amount|quantity|qty|buy)\b/i.test(`${input.name || ''} ${input.id || ''} ${input.placeholder || ''} ${input.getAttribute('aria-label') || ''}`));
          if (labelled || inputs.length === 1) return labelled || inputs[0];
        }
        return null;
      }

      function fillMaximum(node, price, kind = '') {
        const input = kind === 'bazaar' ? bazaarQuantityInput(node) : node.querySelector('input[data-testid="legacy-money-input"]:not([type="hidden"]),input.input-money:not([type="hidden"]),input[type="number"]');
        if (!input || input.disabled || input.readOnly) return false;
        const dataStock = Number(String(input.dataset?.money || '').replace(/[^\d]/g, '')) || 0;
        const textStock = Number(String(node.textContent || '').match(/([\d,]+)\s+(?:available|in stock)/i)?.[1]?.replaceAll(',', '')) || 0;
        const stock = dataStock || textStock || Number(input.max) || 1;
        const fillSignature = `${Math.trunc(Number(price) || 0)}:${Math.trunc(stock)}`;
        if (kind !== 'bazaar' && node.getAttribute('data-slink-market-max-applied') === fillSignature && Number(input.value) > 0) return true;
        const money = Number(String(document.querySelector('#user-money')?.dataset?.money || '').replace(/[^\d]/g, '')) || Number.POSITIVE_INFINITY;
        const affordable = Number.isFinite(money) && price > 0 ? Math.floor(money / price) : stock;
        if (affordable < 1) return false;
        const maximum = Math.max(1, Math.min(stock, affordable, 10_000));
        if (kind !== 'bazaar') node.setAttribute('data-slink-market-max-applied', fillSignature);
        const nativeMaximum = input.closest('form,div')?.querySelector('.input-money-symbol input[type="button"],input.wai-btn[type="button"]') || node.querySelector('.input-money-symbol input[type="button"],input.wai-btn[type="button"]');
        if (nativeMaximum && !nativeMaximum.disabled) nativeMaximum.click();
        const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
        if (setter) setter.call(input, String(maximum)); else input.value = String(maximum);
        input.dispatchEvent(new Event('input', { bubbles:true })); input.dispatchEvent(new Event('change', { bubbles:true }));
        return true;
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

      function quickPurchaseAnchor(native, listing) {
        const controlRect = native.getBoundingClientRect(); const listingRect = listing.element.getBoundingClientRect();
        return { offsetLeft:controlRect.left - listingRect.left, offsetTop:controlRect.top - listingRect.top,
          viewportLeft:controlRect.left, viewportTop:controlRect.top, width:controlRect.width, height:controlRect.height };
      }

      function positionQuickBuy(button, spec) {
        const element = spec.listing?.element;
        const useListing = element?.isConnected && (spec.listing.kind !== 'bazaar' || elementVisible(element));
        const listingRect = useListing ? element.getBoundingClientRect() : null;
        const left = listingRect ? listingRect.left + Number(spec.anchor.offsetLeft || 0) : Number(spec.anchor.viewportLeft || 0);
        const top = listingRect ? listingRect.top + Number(spec.anchor.offsetTop || 0) : Number(spec.anchor.viewportTop || 0);
        const nativeRect = spec.native?.getBoundingClientRect?.() || {};
        const width = Math.max(1, Number(spec.anchor.width) || nativeRect.width || 1);
        const height = Math.max(1, Number(spec.anchor.height) || nativeRect.height || 1);
        const hidden = left + width < 0 || top + height < 0 || left > innerWidth || top > innerHeight;
        button.style.display = hidden ? 'none' : 'flex';
        if (hidden) return;
        button.style.left = `${Math.round(left * 10) / 10}px`;
        button.style.top = `${Math.round(top * 10) / 10}px`;
        button.style.width = `${Math.round(width * 10) / 10}px`;
        button.style.height = `${Math.round(height * 10) / 10}px`;
      }

      function syncQuickBuyPositions() {
        if (quickBuyPositionFrame) return;
        quickBuyPositionFrame = global.requestAnimationFrame(() => {
          quickBuyPositionFrame = null;
          quickBuyControls.forEach(spec => positionQuickBuy(spec.button, spec));
        });
      }

      function removeQuickBuy(controlKey) {
        const spec = quickBuyControls.get(controlKey);
        spec?.button?.remove();
        quickBuyControls.delete(controlKey);
        if (!quickBuyControls.size) { quickBuyLayer?.remove(); quickBuyLayer = null; }
      }

      function clearQuickBuys() {
        [...quickBuyControls.keys()].forEach(removeQuickBuy);
        document.querySelectorAll('[data-slink-market-buy]').forEach(button => button.remove());
        document.querySelectorAll('[data-slink-market-buy-native]').forEach(native => native.removeAttribute('data-slink-market-buy-native'));
        quickBuyLayer?.remove(); quickBuyLayer = null;
      }

      function normalizedPurchaseText(value) { return String(value || '').toLowerCase().replace(/[’']/g, '').replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim(); }

      function listingFor(kind, element) {
        const input = element.querySelector('input[data-testid="legacy-money-input"]:not([type="hidden"]),input.input-money:not([type="hidden"]),input[type="number"]');
        const stock = Number(String(input?.dataset?.money || '').replace(/[^\d]/g, ''))
          || Number(String(element.textContent || '').match(/([\d,]+)\s+(?:available|in stock)/i)?.[1]?.replaceAll(',', '')) || Number(input?.max) || 1;
        const sellerHref = element.querySelector('a[href*="profiles.php?XID="]')?.getAttribute('href') || '';
        return { kind, element, itemId:nodeItemId(element) || pageItemId(purchasePage() || {}), itemName:nodeName(element),
          price:nodePrice(element), stock, sellerId:Number(sellerHref.match(/[?&]XID=(\d+)/i)?.[1]) || 0 };
      }

      function sameListing(flow, listing) {
        if (!flow || !listing || flow.kind !== listing.kind) return false;
        if (flow.kind === 'bazaar') {
          if (flow.itemId > 0 && listing.itemId > 0 && Number(flow.itemId) !== Number(listing.itemId)) return false;
          if (Number(flow.price) !== Number(listing.price)) return false;
          return !flow.itemName || !listing.itemName || normalizedPurchaseText(flow.itemName) === normalizedPurchaseText(listing.itemName);
        }
        if (flow.element?.isConnected) return listing.element === flow.element;
        return Number(flow.itemId) === Number(listing.itemId) && Number(flow.price) === Number(listing.price)
          && (!flow.sellerId || !listing.sellerId || Number(flow.sellerId) === Number(listing.sellerId));
      }

      function highlightedElements(kind) {
        const selector = kind === 'bazaar'
          ? '[data-slink-market-highlight][data-slink-market-kind="bazaar"]'
          : '[data-slink-market-highlight][data-slink-market-kind="item-market"]';
        return [...document.querySelectorAll(selector)];
      }

      function resolvedListing(flow) {
        if (!flow) return null;
        const candidates = flow.kind === 'bazaar' ? [...new Set([flow.element?.isConnected ? flow.element : null, ...purchaseNodes({ bazaar:true })].filter(Boolean))] : highlightedElements('item-market');
        return candidates.map(element => listingFor(flow.kind, element)).find(listing => sameListing(flow, listing)) || flow;
      }

      function nativeControl(element, selector) {
        return [...(element?.querySelectorAll?.(selector) || [])].find(control => control.isConnected && !control.matches('[data-slink-market-buy]')
          && !control.disabled && control.getAttribute('aria-disabled') !== 'true') || null;
      }

      function measurable(control) { return elementVisible(control) && control.getBoundingClientRect().width > 0 && control.getBoundingClientRect().height > 0; }

      function listingKey(listing) {
        if (listing.kind === 'bazaar') return `bazaar:${listing.itemId || normalizedPurchaseText(listing.itemName)}:${listing.price}`;
        let id = quickPurchaseListingIds.get(listing.element);
        if (!id) { id = ++quickPurchaseListingIdCounter; quickPurchaseListingIds.set(listing.element, id); }
        return `item-market:${id}`;
      }

      function confirmation(flow) {
        if (!flow || Date.now() - Number(flow.startedAt || 0) > QUICK_PURCHASE_FLOW_TIMEOUT_MS) return null;
        const selector = flow.kind === 'bazaar' ? '[data-testid="buy-confirmation"]' : '[class*="confirmWrapper___"]';
        return [...document.querySelectorAll(selector)].find(wrapper => {
          if (!elementVisible(wrapper)) return false;
          const text = normalizedPurchaseText(wrapper.textContent); const name = normalizedPurchaseText(flow.itemName);
          if (name && !text.includes(name)) return false;
          const expected = Number(flow.price) * Math.max(1, Number(flow.quantity) || 1);
          const totals = [...String(wrapper.textContent || '').matchAll(/\$\s*([\d,]+)/g)].map(match => Number(match[1].replaceAll(',', '')));
          return !expected || !totals.length || totals.includes(expected);
        }) || null;
      }

      function desiredControls() {
        const desired = new Map();
        if (!current?.settings?.quickBuyEnabled) return desired;
        if (quickPurchaseFlow && Date.now() - Number(quickPurchaseFlow.startedAt || 0) > QUICK_PURCHASE_FLOW_TIMEOUT_MS) quickPurchaseFlow = null;
        const flow = quickPurchaseFlow; const confirm = confirmation(flow);
        if (confirm) {
          const yes = flow.kind === 'bazaar' ? confirm.querySelector('button[aria-label="Yes"]') : [...confirm.querySelectorAll('button')].find(button => /^yes$/i.test(button.textContent.trim()));
          if (yes && !yes.disabled) desired.set(flow.controlKey, { stage:'confirm', listing:resolvedListing(flow), native:yes, anchor:flow.anchor, controlKey:flow.controlKey, label:'Yes' });
          return desired;
        }
        if (flow) {
          const listing = resolvedListing(flow);
          const selector = flow.kind === 'bazaar' ? 'button[data-testid="buy-button"],button[data-testid="activate-buy-button"]' : 'button[class*="buyButton___"],button[aria-label^="Buy "]';
          let native = flow.kind === 'bazaar'
            ? nativeControl(listing?.element, 'button[data-testid="buy-button"]') || nativeControl(listing?.element, 'button[data-testid="activate-buy-button"]')
            : nativeControl(listing?.element, selector);
          if (flow.kind === 'bazaar' && !measurable(native)) {
            const buyCandidates = [...document.querySelectorAll('button[data-testid="buy-button"]')].filter(control => measurable(control));
            const activateCandidates = [...document.querySelectorAll('button[data-testid="activate-buy-button"]')].filter(control => measurable(control));
            const candidates = buyCandidates.length ? buyCandidates : activateCandidates;
            native = candidates.find(control => {
              const card = purchaseNodes({ bazaar:true }).find(candidate => candidate.contains(control));
              return card && sameListing(flow, listingFor('bazaar', card));
            }) || (candidates.length === 1 ? candidates[0] : null);
          }
          if (!native) {
            const elapsed = Date.now() - Number(flow.lastActionAt || 0);
            if (elapsed < QUICK_PURCHASE_TRANSITION_TIMEOUT_MS && flow.lastNative) {
              desired.set(flow.controlKey, { stage:'waiting', listing, native:flow.lastNative, anchor:flow.anchor, controlKey:flow.controlKey, label:'Wait', disabled:true, passive:true });
              scheduleQuickPurchaseSync(QUICK_PURCHASE_TRANSITION_TIMEOUT_MS - elapsed + 20);
            } else quickPurchaseFlow = null;
            return desired;
          }
          const stage = native.matches('button[data-testid="activate-buy-button"]') ? 'open' : 'buy';
          const elapsed = Date.now() - Number(flow.lastActionAt || 0);
          const waiting = flow.lastStage === stage && elapsed < 1_500;
          desired.set(flow.controlKey, { stage, listing, native, anchor:flow.anchor, controlKey:flow.controlKey,
            label:waiting ? 'Wait' : stage === 'open' ? 'SLINK Buy' : 'Buy max', disabled:waiting, passive:waiting });
          if (waiting) scheduleQuickPurchaseSync(1_520 - elapsed);
          return desired;
        }
        for (const kind of ['bazaar', 'item-market']) for (const element of highlightedElements(kind)) {
          const listing = listingFor(kind, element);
          const selector = kind === 'bazaar' ? 'button[data-testid="buy-button"],button[data-testid="activate-buy-button"]' : 'button[class*="buyButton___"],button[aria-label^="Buy "]';
          const native = kind === 'bazaar'
            ? nativeControl(element, 'button[data-testid="buy-button"]') || nativeControl(element, 'button[data-testid="activate-buy-button"]')
            : nativeControl(element, selector);
          if (!native || !measurable(native)) continue;
          const controlKey = listingKey(listing); const stage = native.matches('button[data-testid="activate-buy-button"]') ? 'open' : 'buy';
          desired.set(controlKey, { stage, listing, native, anchor:quickPurchaseAnchor(native, listing), controlKey, label:'SLINK Buy' });
        }
        return desired;
      }

      function syncQuickBuys() {
        if (!focusedTornPage()) return;
        const desired = desiredControls(); const now = Date.now();
        quickBuyControls.forEach((spec, key) => {
          if (desired.has(key) && spec.button.isConnected) return;
          if (spec.listing?.kind === 'bazaar' && now - Number(spec.button.dataset.slinkSeenAt || 0) < 900) return;
          removeQuickBuy(key);
        });
        desired.forEach((spec, key) => {
          let record = quickBuyControls.get(key); let button = record?.button;
          if (!button?.isConnected) {
            button = document.createElement('button'); button.type = 'button'; button.dataset.slinkMarketBuy = 'true';
            button.style.cssText = 'position:fixed;box-sizing:border-box;display:flex;align-items:center;justify-content:center;margin:0;padding:0 3px;border:1px solid rgba(255,255,255,.32);border-radius:4px;background:linear-gradient(#b9ff68,#68c51d);box-shadow:inset 0 1px rgba(255,255,255,.48),0 0 7px rgba(112,255,40,.55);color:#111;font:700 10px/1.1 Arial,sans-serif;text-align:center;text-transform:uppercase;overflow:hidden;cursor:pointer;pointer-events:auto';
            ensureQuickBuyLayer().appendChild(button);
          }
          button.textContent = spec.label; button.disabled = spec.disabled === true; button.dataset.slinkSeenAt = String(now);
          button.dataset.slinkMarketBuyStage = spec.stage; button.style.pointerEvents = spec.passive ? 'none' : 'auto';
          if (spec.stage === 'confirm') { button.style.color = '#fff'; button.style.background = 'linear-gradient(#ff4fbd,#be197d)'; }
          else { button.style.color = '#111'; button.style.background = 'linear-gradient(#b9ff68,#68c51d)'; }
          quickPurchaseControlSpecs.set(button, spec); record = { ...spec, button }; quickBuyControls.set(key, record); positionQuickBuy(button, record);
        });
        if (!quickBuyControls.size) { quickBuyLayer?.remove(); quickBuyLayer = null; }
      }

      function scheduleQuickPurchaseSync(delay = 40) {
        if (quickPurchaseSyncTimer) return;
        quickPurchaseSyncTimer = global.setTimeout(() => { quickPurchaseSyncTimer = null; syncQuickBuys(); }, Math.max(0, delay));
      }

      function handleQuickBuy(event) {
        const button = event.target?.closest?.('button[data-slink-market-buy]'); if (!button) return;
        event.preventDefault(); event.stopImmediatePropagation();
        const spec = quickPurchaseControlSpecs.get(button);
        if (!event.isTrusted || spec?.passive || !focusedTornPage() || !spec?.native?.isConnected || spec.native.disabled) return;
        if (spec.stage === 'confirm') {
          button.disabled = true; button.textContent = 'Sending'; spec.native.click();
          global.setTimeout(() => { quickPurchaseFlow = null; scheduleFormat(); }, 2050); return;
        }
        const continuing = quickPurchaseFlow?.controlKey === spec.controlKey;
        if (!continuing && !spec.listing.element.hasAttribute('data-slink-market-highlight')) return;
        if (spec.stage === 'buy') {
          fillMaximum(spec.listing.element, spec.listing.price, spec.listing.kind);
          const input = spec.listing.kind === 'bazaar' ? bazaarQuantityInput(spec.listing.element) : spec.listing.element.querySelector('input[data-testid="legacy-money-input"]:not([type="hidden"]),input.input-money:not([type="hidden"]),input[type="number"]');
          spec.listing.quantity = Math.max(1, Number(String(input?.value || '1').replace(/[^\d]/g, '')) || 1);
        }
        const now = Date.now(); quickPurchaseFlow = { ...spec.listing, anchor:spec.anchor, controlKey:spec.controlKey,
          startedAt:Number(quickPurchaseFlow?.startedAt) || now, lastActionAt:now, lastStage:spec.stage, lastNative:spec.native };
        button.disabled = true; button.textContent = 'Opening'; spec.native.click();
        [40, 160, 450].forEach(delay => global.setTimeout(scheduleFormat, delay));
        global.setTimeout(() => { scheduleFormat(); }, 1650);
      }

      function handleNativeBazaarBuy(event) {
        const control = event.target?.closest?.('button,[role="button"]');
        if (!control || control.matches('[data-slink-market-buy]') || !control.matches('[data-testid="activate-buy-button"],[data-testid="buy-button"]')) return;
        const card = purchaseNodes({ bazaar:true }).find(candidate => candidate.contains(control)); if (!card || nodeUnavailable(card, 'bazaar')) return;
        pendingBazaarPurchase = { card, price:nodePrice(card), clickedAt:Date.now() };
        [0, 60, 180, 420, 900, 1500].forEach(delay => global.setTimeout(() => {
          if (pendingBazaarPurchase && Date.now() - pendingBazaarPurchase.clickedAt < 2000) fillMaximum(card, pendingBazaarPurchase.price, 'bazaar');
          if (delay === 1500) pendingBazaarPurchase = null;
        }, delay));
      }

      function formatPurchasePage() {
        if (stopped) return;
        const page = purchasePage();
        const cleanup = node => {
          node.removeAttribute('data-slink-market-highlight');
          node.removeAttribute('data-slink-market-kind');
          node.removeAttribute('data-slink-market-targeted');
          node.removeAttribute('data-slink-market-shop-profit');
          node.removeAttribute('data-slink-market-one-dollar');
          node.removeAttribute('data-slink-market-reason');
          node.removeAttribute('data-slink-market-max-applied');
          node.style.removeProperty('outline');
          node.style.removeProperty('outline-offset');
          node.style.removeProperty('box-shadow');
        };
        if (!page) {
          document.querySelectorAll('[data-slink-market-highlight]').forEach(cleanup);
          clearQuickBuys();
          return;
        }
        const nodes = purchaseNodes(page);
        const matched = new Set();
        for (const node of nodes) {
          const kind = page.bazaar ? 'bazaar' : node.matches('li[class*="rowWrapper___"],[data-testid="seller-row"],[data-testid="market-listing"]') ? 'item-market' : 'item-overview';
          const price = nodePrice(node);
          const itemId = nodeItemId(node) || pageItemId(page);
          const item = catalogItem(node, page);
          const itemMatches = page.itemId <= 0 || itemId <= 0 || itemId === page.itemId;
          const targeted = page.linked && itemMatches && price === page.price;
          const state = SLINK.core.market.listingHighlightState({ price, shopSellPrice:item?.shopSellPrice, targeted, available:!nodeUnavailable(node, kind) });
          if (!state.highlighted) { if (node.hasAttribute('data-slink-market-highlight')) cleanup(node); continue; }
          matched.add(node);
          node.dataset.slinkMarketHighlight = state.targeted ? 'targeted' : state.shopProfit ? 'shop-profit' : 'one-dollar';
          node.dataset.slinkMarketKind = kind;
          node.toggleAttribute('data-slink-market-targeted', state.targeted);
          node.toggleAttribute('data-slink-market-shop-profit', state.shopProfit);
          node.toggleAttribute('data-slink-market-one-dollar', state.oneDollar);
          const color = state.targeted || state.oneDollar ? '#39ff14' : '#ff4fbd';
          const glow = state.targeted || state.oneDollar ? 'rgba(57,255,20,.72)' : 'rgba(255,79,189,.68)';
          node.style.setProperty('outline', `4px solid ${color}`, 'important');
          node.style.setProperty('outline-offset', '2px', 'important');
          node.style.setProperty('box-shadow', `0 0 18px 5px ${glow}`, 'important');
          node.dataset.slinkMarketReason = state.targeted ? 'SLINK API-matched listing' : state.shopProfit ? `Below city shop sell price${item?.shopSellPrice ? ` ($${Number(item.shopSellPrice).toLocaleString()})` : ''}` : '$1 purchase opportunity';
          if (kind === 'item-market') fillMaximum(node, price);
        }
        document.querySelectorAll('[data-slink-market-highlight]').forEach(node => { if (!matched.has(node)) cleanup(node); });
        syncQuickBuys();
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
          <div class="slink-market-actions"><label class="slink-market-sound"><input type="checkbox" data-market-sound ${status?.settings?.soundEnabled === false ? '' : 'checked'}> Play deal sounds</label><button type="button" data-market-copy-all ${deals.length ? '' : 'disabled'}>Copy item list</button><button type="button" data-market-send-all disabled>Send list to Faction</button></div>
          <div class="slink-market-list">${deals.length ? deals.map(row => `<article class="slink-market-deal"><strong>${escapeHtml(row.source)} · ${escapeHtml(row.itemName)}</strong><span>${escapeHtml(row.detail)}</span><div class="slink-market-actions"><a href="${escapeHtml(row.href)}" target="_self">Open &amp; highlight</a><button type="button" data-market-copy="${escapeHtml(row.id)}">Copy</button><button type="button" data-market-send="${escapeHtml(row.id)}" disabled>Send to Faction</button><button type="button" data-market-dismiss="${escapeHtml(row.id)}">Dismiss 5m</button></div></article>`).join('') : '<div class="slink-market-empty">No watched listing is currently at or below its target.</div>'}</div>`;
        const copyAll = root.querySelector('[data-market-copy-all]');
        const sendAll = root.querySelector('[data-market-send-all]');
        root.querySelector('[data-market-sound]')?.addEventListener('change', async event => {
          event.currentTarget.disabled = true;
          try { render(await SLINK.core.messaging.send('market.settings.save', { soundEnabled:event.currentTarget.checked })); }
          catch (error) { ui.setStatus(SLINK.core.format.errorMessage(error), 'error'); event.currentTarget.disabled = false; }
        });
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
        try { render(await SLINK.core.messaging.send('market.status', { refreshIfDue })); await claimMarketSound(); }
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
      document.addEventListener('click', handleQuickBuy, true);
      document.addEventListener('click', handleNativeBazaarBuy, true);
      document.addEventListener('pointerdown', unlockAndRetrySound, true);
      document.addEventListener('keydown', unlockAndRetrySound, true);
      await load(false);
      global.addEventListener('slink:api-usage', updateApiUsage);
      timer = global.setInterval(() => { if (!stopped) void load(true); }, 15_000);
      clockTimer = global.setInterval(() => { if (!stopped) updateStatus(); }, 1_000);
      return { stop() { stopped = true; observer?.disconnect(); if (timer) global.clearInterval(timer); if (clockTimer) global.clearInterval(clockTimer); if (formatTimer) global.clearTimeout(formatTimer); if (quickPurchaseSyncTimer) global.clearTimeout(quickPurchaseSyncTimer); if (quickBuyPositionFrame) global.cancelAnimationFrame(quickBuyPositionFrame); global.removeEventListener('slink:api-usage', updateApiUsage); global.removeEventListener('hashchange', scheduleFormat); global.removeEventListener('popstate', scheduleFormat); global.removeEventListener('resize', syncQuickBuyPositions); global.removeEventListener('scroll', syncQuickBuyPositions, true); document.removeEventListener('click', handleQuickBuy, true); document.removeEventListener('click', handleNativeBazaarBuy, true); document.removeEventListener('pointerdown', unlockAndRetrySound, true); document.removeEventListener('keydown', unlockAndRetrySound, true); ui.setAlertCount('market', 0); clearQuickBuys(); quickPurchaseFlow = null; document.querySelectorAll('[data-slink-market-highlight]').forEach(node => { node.removeAttribute('data-slink-market-highlight'); node.removeAttribute('data-slink-market-kind'); node.removeAttribute('data-slink-market-targeted'); node.removeAttribute('data-slink-market-shop-profit'); node.removeAttribute('data-slink-market-one-dollar'); node.removeAttribute('data-slink-market-reason'); node.removeAttribute('data-slink-market-max-applied'); node.style.removeProperty('outline'); node.style.removeProperty('outline-offset'); node.style.removeProperty('box-shadow'); }); } };
    }
  });
})(globalThis);
