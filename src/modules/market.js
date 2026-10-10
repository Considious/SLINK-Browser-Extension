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
      let visibilityObserver = null;
      let moduleView = null;
      let lastActivityTouchAt = 0;
      const INACTIVE_AFTER_MS = 5 * 60_000;
      const QUICK_PURCHASE_TRANSITION_TIMEOUT_MS = 2_500;
      const QUICK_PURCHASE_FLOW_TIMEOUT_MS = 10_000;
      const purchaseState = {
        itemCatalog:{ fetchedAt:0, items:[] },
        itemCatalogLoading:false,
        settings:{ apiKey:'extension-managed', highlightedQuickBuyEnabled:true },
        bazaarCatalogRequestedAt:0,
        pendingBazaarPurchase:null,
        quickPurchaseListingIds:new WeakMap(),
        quickPurchaseListingIdCounter:0,
        quickPurchaseFlow:null,
        quickPurchaseOverlays:new Map(),
        quickPurchaseControlSpecs:new WeakMap(),
        domTestEnabled:false,
        bazaarOneDollarTimer:null,
        quickPurchaseSyncTimer:null
      };
      const marketDomTestAllowed = SLINK.core.permissions.hasScope(context.permissions, 'admin.*');

      ui.setModuleStyles(`
        .slink-market-summary{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:5px}.slink-market-summary>div{padding:7px;border:1px solid var(--slink-border-soft);border-radius:7px;background:var(--slink-bg-control);text-align:center}.slink-market-summary strong,.slink-market-summary small{display:block}.slink-market-summary small{color:var(--slink-muted)}
        .slink-market-list{display:grid;gap:7px}.slink-market-deal{padding:8px;border:1px solid var(--slink-border-soft);border-left:4px solid var(--slink-ready);border-radius:7px;background:var(--slink-bg-control)}.slink-market-deal strong,.slink-market-deal span{display:block}.slink-market-deal span{margin-top:2px;color:var(--slink-muted)}
        .slink-market-actions{display:flex;flex-wrap:wrap;gap:5px;margin-top:7px}.slink-market-actions a,.slink-market-actions button{display:inline-flex;align-items:center;justify-content:center;min-height:28px;padding:4px 8px;border:1px solid var(--slink-border);border-radius:6px;background:var(--slink-bg);color:var(--slink-text);font:inherit;text-decoration:none;cursor:pointer}.slink-market-actions button:disabled{opacity:.45;cursor:not-allowed}.slink-market-empty{padding:16px;border-radius:7px;background:var(--slink-bg-control);color:var(--slink-muted);text-align:center}
        .slink-market-sound{display:flex;align-items:center;gap:6px;color:var(--slink-text);font-size:12px}.slink-market-sound input{margin:0}
      `);

      function focusedTornPage() {
        // PDA/WebView and some Torn SPA transitions can report hasFocus() as
        // false while the visible page is still fully interactive.
        return document.visibilityState !== 'hidden';
      }

      async function claimMarketSound() {
        try { await SLINK.core.messaging.send('audio.flush'); } catch {}
      }

      function moduleVisible() {
        return Boolean(moduleView && !moduleView.hidden);
      }

      async function touchMarketActivity(force = false) {
        if (!moduleVisible()) return false;
        const now = Date.now();
        if (!force && now - lastActivityTouchAt < 10_000) return true;
        lastActivityTouchAt = now;
        try { await SLINK.core.messaging.send('market.activity.touch'); } catch {}
        return true;
      }

      function noteMarketInteraction() {
        if (moduleVisible()) void touchMarketActivity(false);
      }

      function syncMarketVisibility() {
        if (!moduleVisible()) return;
        void touchMarketActivity(true).then(() => {
          if (stopped) return;
          void load(false);
          void load(true);
        });
      }

      function syncPurchaseCatalog(status = current) {
        const catalog = status?.catalog && typeof status.catalog === 'object' ? status.catalog : { fetchedAt:0, items:[] };
        purchaseState.itemCatalog = {
          fetchedAt:Number(catalog.fetchedAt) || 0,
          items:(Array.isArray(catalog.items) ? catalog.items : []).map(item => ({
            ...item,
            id:Math.trunc(Number(item?.id) || 0),
            name:String(item?.name || ''),
            sellPrice:Math.max(0, Math.trunc(Number(item?.shopSellPrice ?? item?.sellPrice) || 0))
          }))
        };
        purchaseState.settings.highlightedQuickBuyEnabled = status?.settings?.quickBuyEnabled !== false;
      }

      function itemCatalogFresh() {
        return purchaseState.itemCatalog.items.length > 0
          && Date.now() - Number(purchaseState.itemCatalog.fetchedAt || 0) < 24 * 60 * 60_000;
      }

      function catalogItemBySearch(search) {
        const normalized = String(search || '').trim().toLocaleLowerCase();
        if (!normalized) return null;
        return purchaseState.itemCatalog.items.find(item => item.name.toLocaleLowerCase() === normalized) || null;
      }

      function ownsDashboardNetworkLease() {
        return true;
      }

      async function loadItemCatalog({ force = false } = {}) {
        purchaseState.itemCatalogLoading = true;
        try {
          const status = await SLINK.core.messaging.send('market.catalog', { force });
          current = status;
          syncPurchaseCatalog(status);
          return purchaseState.itemCatalog;
        } finally {
          purchaseState.itemCatalogLoading = false;
        }
      }

      function onBazaarPage() {
        return /\/bazaar\.php$/i.test(location.pathname);
      }

      function onItemMarketPage() {
        const url = new URL(location.href);
        const sid = String(url.searchParams.get('sid') || '').toLowerCase();
        return sid === 'itemmarket'
          || /\/itemmarket\.php$/i.test(url.pathname)
          || /(?:^|\/)itemmarket(?:\/|$)/i.test(url.hash.replace(/^#\/?/, ''));
      }

      function onPurchaseOpportunityPage() {
        return onBazaarPage() || onItemMarketPage();
      }

      function targetedBazaarListing() {
        if (!onBazaarPage()) return null;
        const params = new URL(location.href).searchParams;
        if (params.get('highlight') !== '1' && params.get('slinkHighlight') !== '1') return null;
        const sellerId = Math.trunc(Number(params.get('userId')) || 0);
        const itemId = Math.trunc(Number(params.get('itemId')) || 0);
        const price = Math.trunc(Number(params.get('price')) || 0);
        return sellerId > 0 && itemId > 0 && price > 0 ? { sellerId, itemId, price } : null;
      }

      function ensurePurchaseHighlightStyles() {
        if (document.getElementById('tdd-purchase-highlight-styles')) return;
        const style = document.createElement('style');
        style.id = 'tdd-purchase-highlight-styles';
        style.textContent = `
          [data-tdd-bazaar-targeted],
          [data-tdd-bazaar-one-dollar],
          [data-tdd-item-market-one-dollar],
          [data-tdd-market-dom-test] {
            outline: 4px solid #39ff14 !important;
            outline-offset: 2px !important;
            box-shadow: 0 0 18px 5px rgba(57,255,20,.72), inset 0 0 0 2px rgba(57,255,20,.5) !important;
          }
          [data-tdd-bazaar-shop-profit],
          [data-tdd-item-market-shop-profit] {
            outline: 4px solid #ff4fbd !important;
            outline-offset: 2px !important;
            box-shadow: 0 0 18px 5px rgba(255,79,189,.68), inset 0 0 0 2px rgba(255,79,189,.48) !important;
          }
          #tdd-quick-buy-layer {
            position: fixed;
            inset: 0;
            z-index: 2147483646;
            pointer-events: none;
          }
          button[data-tdd-quick-buy] {
            position: fixed;
            box-sizing: border-box;
            margin: 0;
            padding: 0 3px;
            border: 1px solid rgba(255,255,255,.32);
            border-radius: 4px;
            color: #111;
            background: linear-gradient(#b9ff68, #68c51d);
            box-shadow: inset 0 1px rgba(255,255,255,.48), 0 0 7px rgba(112,255,40,.55);
            font: 700 10px/1.1 Arial, sans-serif;
            text-transform: uppercase;
            cursor: pointer;
            pointer-events: auto;
          }
          button[data-tdd-quick-buy][data-tdd-quick-buy-stage="confirm"] {
            color: #fff;
            background: linear-gradient(#ff4fbd, #be197d);
            box-shadow: inset 0 1px rgba(255,255,255,.35), 0 0 8px rgba(255,79,189,.62);
          }
          button[data-tdd-quick-buy]:disabled {
            opacity: .6;
            cursor: wait;
          }
          button[data-tdd-quick-buy][data-tdd-quick-buy-passive="true"] {
            opacity: .45;
            pointer-events: none;
          }
        `;
        document.head?.appendChild(style);
      }

      function bazaarCardPrice(card) {
        const priceElement = card?.querySelector?.('[data-testid="price"]');
        if (!priceElement) return null;
        for (const node of priceElement.childNodes) {
          if (node.nodeType !== Node.TEXT_NODE) continue;
          const match = String(node.textContent || '').replaceAll(',', '').match(/\$?\s*(\d+(?:\.\d+)?)/);
          if (match) return Number(match[1]);
        }
        const match = String(priceElement.textContent || '').match(/^\s*\$?\s*([\d,]+(?:\.\d+)?)/);
        return match ? Number(match[1].replaceAll(',', '')) : null;
      }

      function bazaarCssColorLooksRed(value) {
        const match = String(value || '').match(/rgba?\(\s*(\d+(?:\.\d+)?)\D+(\d+(?:\.\d+)?)\D+(\d+(?:\.\d+)?)(?:\D+(\d+(?:\.\d+)?))?/i);
        if (!match || (match[4] != null && Number(match[4]) === 0)) return false;
        const red = Number(match[1]);
        const green = Number(match[2]);
        const blue = Number(match[3]);
        return red >= 90 && green <= red * 0.65 && blue <= red * 0.8;
      }

      function bazaarCardUnavailable(card) {
        const priceElement = card.querySelector('[data-testid="price"]');
        const blockedPurchaseSelector = '[class*="isBlockedForBuying"], #isBlockedForBuyingTooltip';
        const unavailableSelector = '[aria-disabled="true"], [data-disabled="true"], [class*="disabled" i], [class*="unavailable" i], [class*="soldOut" i], [class*="cannotBuy" i]';
        if (card.querySelector(blockedPurchaseSelector)) return true;
        if (card.matches(unavailableSelector) || priceElement?.matches(unavailableSelector)) return true;
        if (/\b(?:cannot buy|can't buy|unavailable|sold out|purchase limit|buy limit)\b/i.test(String(card.textContent || ''))) return true;
        const purchaseControls = Array.from(card.querySelectorAll('button, [role="button"]')).filter((control) => (
          !control.matches?.('[data-tdd-quick-buy]')
          && /\b(?:buy|purchase)\b/i.test(`${control.textContent || ''} ${control.getAttribute('aria-label') || ''} ${control.getAttribute('title') || ''}`)
        ));
        if (purchaseControls.length && !purchaseControls.some((control) => !control.disabled && control.getAttribute('aria-disabled') !== 'true')) return true;
        const cardStyle = getComputedStyle(card);
        const priceStyle = priceElement ? getComputedStyle(priceElement) : null;
        return bazaarCssColorLooksRed(cardStyle.backgroundColor)
          || bazaarCssColorLooksRed(cardStyle.borderColor)
          || bazaarCssColorLooksRed(priceStyle?.color)
          || bazaarCssColorLooksRed(priceStyle?.backgroundColor);
      }

      function bazaarListingCards() {
        const container = document.querySelector('[data-testid="bazaar-items"]');
        if (!container) return [];
        const direct = Array.from(container.querySelectorAll('[data-testid="item"]'));
        if (direct.length) return direct;
        return [...new Set(Array.from(container.querySelectorAll('img[src*="/images/items/"], img[srcset*="/images/items/"]'))
          .map((image) => image.closest('[class*="item___"]'))
          .filter(Boolean))];
      }

      function bazaarCardItemId(card) {
        const image = card?.querySelector?.('img[src*="/images/items/"], img[srcset*="/images/items/"]');
        const match = `${image?.getAttribute('src') || ''} ${image?.getAttribute('srcset') || ''}`.match(/\/images\/items\/(\d+)\//i);
        return match ? Math.trunc(Number(match[1])) : 0;
      }

      function bazaarCardMatchesTarget(card, target = targetedBazaarListing()) {
        if (!target) return false;
        return bazaarCardItemId(card) === target.itemId && bazaarCardPrice(card) === target.price;
      }

      function bazaarCardStock(card) {
        const stockText = card?.querySelector?.('[data-testid="amount-value"]')?.textContent
          || String(card?.textContent || '').match(/([\d,]+)\s+in stock/i)?.[1]
          || '';
        const stock = Number(String(stockText).replace(/[^\d]/g, ''));
        return Number.isFinite(stock) && stock > 0 ? Math.trunc(stock) : 0;
      }

      function catalogItemById(itemId) {
        const id = Math.trunc(Number(itemId));
        return id > 0 ? purchaseState.itemCatalog.items.find((item) => item.id === id) || null : null;
      }

      function bazaarCardItemName(card) {
        return String(card?.querySelector?.('[data-testid="name"]')?.textContent || '')
          .replace(/\s+/g, ' ')
          .trim();
      }

      function catalogItemForBazaarCard(card) {
        return catalogItemById(bazaarCardItemId(card)) || catalogItemBySearch(bazaarCardItemName(card));
      }

      function itemCatalogHasSellPrices() {
        return purchaseState.itemCatalog.items.some((item) => Object.hasOwn(item, 'sellPrice'));
      }

      function requestPurchaseSellPriceCatalog() {
        if ((itemCatalogFresh() && itemCatalogHasSellPrices()) || purchaseState.itemCatalogLoading || !purchaseState.settings.apiKey || !ownsDashboardNetworkLease()) return;
        if (Date.now() - Number(purchaseState.bazaarCatalogRequestedAt || 0) < 5 * 60_000) return;
        purchaseState.bazaarCatalogRequestedAt = Date.now();
        void loadItemCatalog({ force: true }).then(() => schedulePurchaseOpportunityFormatting(0));
      }

      function bazaarPurchaseOpportunity(card) {
        const price = bazaarCardPrice(card);
        const available = !bazaarCardUnavailable(card);
        const sellPrice = Number(catalogItemForBazaarCard(card)?.sellPrice) || 0;
        const oneDollar = available && price === 1;
        const shopProfit = available && !oneDollar && price !== null && sellPrice > 0 && price < sellPrice;
        return { oneDollar, shopProfit };
      }

      function clearMarketDomTestMarks(kind = '') {
        const selector = kind
          ? `[data-tdd-market-dom-test="${kind}"]`
          : '[data-tdd-market-dom-test]';
        document.querySelectorAll(selector).forEach((element) => element.removeAttribute('data-tdd-market-dom-test'));
      }

      function marketDomTestTarget(kind, elements) {
        const candidates = Array.from(elements || []);
        const enabled = marketDomTestAllowed && purchaseState.domTestEnabled;
        const target = enabled ? candidates.find((element) => {
          if (!element?.isConnected || !elementVisible(element)) return false;
          if (kind === 'bazaar') {
            if (bazaarCardUnavailable(element)) return false;
            return Boolean(nativeQuickPurchaseControl(element, 'button[data-testid="buy-button"], button[data-testid="activate-buy-button"]'));
          }
          if (itemMarketRowUnavailable(element)) return false;
          return Boolean(nativeQuickPurchaseControl(element, 'button[class*="buyButton___"], button[aria-label^="Buy "]'));
        }) || null : null;
        document.querySelectorAll(`[data-tdd-market-dom-test="${kind}"]`).forEach((element) => {
          if (element !== target) element.removeAttribute('data-tdd-market-dom-test');
        });
        if (target) target.setAttribute('data-tdd-market-dom-test', kind);
        return target;
      }

      function formatBazaarOneDollarListings() {
        if (!focusedTornPage() || !onBazaarPage()) return;
        ensurePurchaseHighlightStyles();
        requestPurchaseSellPriceCatalog();
        const cards = new Set(bazaarListingCards());
        marketDomTestTarget('bazaar', cards);
        const target = targetedBazaarListing();
        document.querySelectorAll('[data-tdd-bazaar-targeted]').forEach((card) => {
          if (!cards.has(card)) card.removeAttribute('data-tdd-bazaar-targeted');
        });
        document.querySelectorAll('[data-tdd-bazaar-one-dollar]').forEach((card) => {
          if (!cards.has(card)) card.removeAttribute('data-tdd-bazaar-one-dollar');
        });
        document.querySelectorAll('[data-tdd-bazaar-shop-profit]').forEach((card) => {
          if (!cards.has(card)) card.removeAttribute('data-tdd-bazaar-shop-profit');
        });
        cards.forEach((card) => {
          const { oneDollar, shopProfit } = bazaarPurchaseOpportunity(card);
          card.toggleAttribute('data-tdd-bazaar-targeted', bazaarCardMatchesTarget(card, target));
          card.toggleAttribute('data-tdd-bazaar-one-dollar', oneDollar);
          card.toggleAttribute('data-tdd-bazaar-shop-profit', shopProfit);
        });
      }

      function itemMarketSellerRows() {
        return [...new Set(Array.from(document.querySelectorAll('ul[class*="sellerList___"]'))
          .flatMap((list) => Array.from(list.querySelectorAll('li[class*="rowWrapper___"]')))
          .filter((row) => row.querySelector('[class*="sellerRow___"]')))];
      }

      function itemMarketRowPrice(row) {
        const text = String(row?.querySelector?.('[class*="price___"]')?.textContent || '');
        const match = text.match(/\$\s*([\d,]+(?:\.\d+)?)/);
        return match ? Number(match[1].replaceAll(',', '')) : null;
      }

      function itemImageId(image) {
        const match = `${image?.getAttribute?.('src') || ''} ${image?.getAttribute?.('srcset') || ''}`.match(/\/images\/items\/(\d+)\//i);
        return match ? Math.trunc(Number(match[1])) : 0;
      }

      function itemMarketPageItemId() {
        const locationMatch = `${location.search}&${location.hash}`.match(/(?:^|[?&#/])(?:itemid|item_id)=(\d+)/i);
        if (locationMatch) return Math.trunc(Number(locationMatch[1]));
        const main = document.querySelector('#mainContainer, #main-container, [data-testid="main-content"], main[role="main"], main');
        const ids = [...new Set(Array.from(main?.querySelectorAll?.('img[src*="/images/items/"], img[srcset*="/images/items/"]') || [])
          .map(itemImageId)
          .filter((itemId) => itemId > 0))];
        return ids.length === 1 ? ids[0] : 0;
      }

      function itemMarketPageItemName(itemId = itemMarketPageItemId()) {
        const main = document.querySelector('#mainContainer, #main-container, [data-testid="main-content"], main[role="main"], main');
        const matchingImage = itemId > 0
          ? main?.querySelector?.(`img[src*="/images/items/${itemId}/"], img[srcset*="/images/items/${itemId}/"]`)
          : null;
        return String(matchingImage?.getAttribute('alt') || '')
          .replace(/\s+/g, ' ')
          .trim();
      }

      function itemMarketRowItemId(row) {
        const image = row?.querySelector?.('img[src*="/images/items/"], img[srcset*="/images/items/"]');
        return itemImageId(image) || itemMarketPageItemId();
      }

      function itemMarketRowItemName(row) {
        const image = row?.querySelector?.('img[src*="/images/items/"], img[srcset*="/images/items/"]');
        return String(image?.getAttribute('alt') || itemMarketPageItemName(itemImageId(image) || itemMarketPageItemId()))
          .replace(/\s+/g, ' ')
          .trim();
      }

      function itemMarketRowSellerId(row) {
        const href = row?.querySelector?.('a[href*="profiles.php?XID="]')?.getAttribute('href') || '';
        const match = href.match(/[?&]XID=(\d+)/i);
        return match ? Math.trunc(Number(match[1])) : 0;
      }

      function itemMarketQuantityInput(row) {
        return row?.querySelector?.('input[data-testid="legacy-money-input"]:not([type="hidden"]), input.input-money:not([type="hidden"])') || null;
      }

      function itemMarketRowStock(row) {
        const input = itemMarketQuantityInput(row);
        const declared = Number(String(input?.dataset?.money || '').replace(/[^\d]/g, ''));
        if (Number.isFinite(declared) && declared > 0) return Math.trunc(declared);
        const match = String(row?.querySelector?.('[class*="available___"]')?.textContent || row?.textContent || '').match(/([\d,]+)\s+available/i);
        const stock = Number(String(match?.[1] || '').replaceAll(',', ''));
        return Number.isFinite(stock) && stock > 0 ? Math.trunc(stock) : 0;
      }

      function itemMarketRowUnavailable(row) {
        const input = itemMarketQuantityInput(row);
        const buyButton = Array.from(row?.querySelectorAll?.('button[class*="buyButton___"], button[aria-label^="Buy "]') || [])
          .find((button) => !button.matches('[data-tdd-quick-buy]')) || null;
        const priceElement = row?.querySelector?.('[class*="price___"]');
        if (!input || !buyButton || input.disabled || input.readOnly) return true;
        if (/\b(?:cannot buy|can't buy|unavailable|sold out|purchase limit|buy limit)\b/i.test(String(row.textContent || ''))) return true;
        const rowStyle = getComputedStyle(row);
        const priceStyle = priceElement ? getComputedStyle(priceElement) : null;
        return bazaarCssColorLooksRed(rowStyle.backgroundColor)
          || bazaarCssColorLooksRed(rowStyle.borderColor)
          || bazaarCssColorLooksRed(priceStyle?.color)
          || bazaarCssColorLooksRed(priceStyle?.backgroundColor);
      }

      function catalogItemForItemMarketRow(row) {
        return catalogItemById(itemMarketRowItemId(row)) || catalogItemBySearch(itemMarketRowItemName(row));
      }

      function fillItemMarketPurchaseMaximum(row, price) {
        if (!focusedTornPage()) return false;
        const input = itemMarketQuantityInput(row);
        if (!input || input.disabled || input.readOnly) return false;
        const stock = itemMarketRowStock(row);
        const fillSignature = `${Math.trunc(Number(price) || 0)}:${stock}`;
        if (row.getAttribute('data-tdd-item-market-max-applied') === fillSignature) return true;
        const declaredMax = Number(input.max || input.getAttribute('aria-valuemax') || input.dataset.max || input.dataset.money);
        const moneyText = document.querySelector('#user-money')?.dataset?.money;
        const normalizedMoney = String(moneyText ?? '').replace(/[^\d.-]/g, '');
        const money = normalizedMoney ? Number(normalizedMoney) : null;
        const affordable = Number(price) > 0 && Number.isFinite(money) ? Math.floor(money / Number(price)) : null;
        if (affordable !== null && affordable < 1) return false;
        const candidates = [stock, declaredMax, affordable, 10_000].filter((value) => Number.isFinite(value) && value > 0);
        if (!candidates.length) return false;
        const maximum = Math.max(1, Math.trunc(Math.min(...candidates)));
        row.setAttribute('data-tdd-item-market-max-applied', fillSignature);
        // Use Torn's own maximum control when present so its internal input state is
        // updated, then apply the native setter/events as a fallback for layouts
        // where that control is supplied by another script or reacts asynchronously.
        const nativeMaximumControl = row.querySelector('.input-money-symbol input[type="button"], input.wai-btn[type="button"]');
        if (nativeMaximumControl && !nativeMaximumControl.disabled) nativeMaximumControl.click();
        if (Number(input.value) === maximum) return true;
        const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
        if (setter) setter.call(input, String(maximum));
        else input.value = String(maximum);
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
        return true;
      }

      function formatItemMarketPurchaseOpportunities() {
        if (!focusedTornPage() || !onItemMarketPage()) return;
        const rows = new Set(itemMarketSellerRows());
        marketDomTestTarget('item-market', rows);
        document.querySelectorAll('[data-tdd-item-market-one-dollar], [data-tdd-item-market-shop-profit]').forEach((row) => {
          if (!rows.has(row)) {
            row.removeAttribute('data-tdd-item-market-one-dollar');
            row.removeAttribute('data-tdd-item-market-shop-profit');
          }
        });
        if (!rows.size) return;
        ensurePurchaseHighlightStyles();
        requestPurchaseSellPriceCatalog();
        rows.forEach((row) => {
          const price = itemMarketRowPrice(row);
          const available = !itemMarketRowUnavailable(row);
          const sellPrice = Number(catalogItemForItemMarketRow(row)?.sellPrice) || 0;
          const oneDollar = available && price === 1;
          const shopProfit = available && !oneDollar && price !== null && sellPrice > 0 && price < sellPrice;
          row.toggleAttribute('data-tdd-item-market-one-dollar', oneDollar);
          row.toggleAttribute('data-tdd-item-market-shop-profit', shopProfit);
          if (oneDollar || shopProfit) fillItemMarketPurchaseMaximum(row, price);
          else row.removeAttribute('data-tdd-item-market-max-applied');
        });
      }

      function bazaarPurchaseButton(control) {
        if (!control) return false;
        if (control.matches('[class*="controlPanelButton___"]')) return true;
        const label = `${control.textContent || ''} ${control.getAttribute('aria-label') || ''} ${control.getAttribute('title') || ''}`.trim();
        return /^(?:buy|purchase)\b/i.test(label);
      }

      function bazaarPurchaseQuantityInput(pending) {
        const itemId = Number(pending?.itemId) || 0;
        const currentCard = pending?.card?.isConnected
          ? pending.card
          : bazaarListingCards().find((card) => bazaarCardItemId(card) === itemId);
        const roots = [currentCard];
        document.querySelectorAll('[class*="buyMenu__"], [class*="buyForm___"], [role="dialog"], [aria-modal="true"], [class*="modal" i], [class*="dialog" i], [class*="confirm" i]').forEach((root) => {
          if (elementVisible(root)) roots.push(root);
        });
        const active = document.activeElement;
        if (active?.matches?.('[class*="buyAmountInput_"], input[type="number"], input[inputmode="numeric"]') && !active.disabled && !active.readOnly) return active;
        for (const root of roots.filter(Boolean)) {
          const inputs = Array.from(root.querySelectorAll('[class*="buyAmountInput_"], input[type="number"], input[inputmode="numeric"], input[pattern*="0-9"]'))
            .filter((input) => !input.disabled && !input.readOnly && elementVisible(input));
          const labelled = inputs.find((input) => /\b(?:amount|quantity|qty|buy)\b/i.test(`${input.name || ''} ${input.id || ''} ${input.placeholder || ''} ${input.getAttribute('aria-label') || ''}`));
          if (labelled || inputs.length === 1) return labelled || inputs[0];
        }
        return null;
      }

      function fillBazaarPurchaseMaximum(pending) {
        if (!focusedTornPage() || !pending || purchaseState.pendingBazaarPurchase !== pending || Date.now() - pending.clickedAt > 2_000) return false;
        const input = bazaarPurchaseQuantityInput(pending);
        if (!input) return false;
        const declaredMax = Number(input.max || input.getAttribute('aria-valuemax') || input.dataset.max);
        const moneyText = document.querySelector('#user-money')?.dataset?.money;
        const normalizedMoney = String(moneyText ?? '').replace(/[^\d.-]/g, '');
        const money = normalizedMoney ? Number(normalizedMoney) : null;
        const affordable = Number(pending.price) > 0 && Number.isFinite(money) ? Math.floor(money / Number(pending.price)) : null;
        if (affordable !== null && affordable < 1) return false;
        const candidates = [Number(pending.stock), declaredMax, affordable, 10_000].filter((value) => Number.isFinite(value) && value > 0);
        if (!candidates.length) return false;
        const maximum = Math.max(1, Math.trunc(Math.min(...candidates)));
        if (Number(input.value) !== maximum) {
          const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
          if (setter) setter.call(input, String(maximum));
          else input.value = String(maximum);
          input.dispatchEvent(new Event('input', { bubbles: true }));
          input.dispatchEvent(new Event('change', { bubbles: true }));
        }
        return true;
      }

      function normalizedPurchaseText(value) {
        return String(value || '')
          .toLocaleLowerCase()
          .replace(/[’']/g, '')
          .replace(/[^a-z0-9]+/g, ' ')
          .replace(/\s+/g, ' ')
          .trim();
      }

      function quickPurchaseListing(kind, element) {
        if (kind === 'bazaar') {
          return {
            kind,
            element,
            itemId: bazaarCardItemId(element),
            itemName: bazaarCardItemName(element),
            price: bazaarCardPrice(element),
            stock: bazaarCardStock(element),
            sellerId: 0,
          };
        }
        return {
          kind,
          element,
          itemId: itemMarketRowItemId(element),
          itemName: itemMarketRowItemName(element),
          price: itemMarketRowPrice(element),
          stock: itemMarketRowStock(element),
          sellerId: itemMarketRowSellerId(element),
        };
      }

      function sameQuickPurchaseListing(flow, listing) {
        if (!flow || !listing || flow.kind !== listing.kind) return false;
        if (flow.element?.isConnected) return listing.element === flow.element;
        if (Number(flow.itemId) > 0 && Number(listing.itemId) > 0 && Number(flow.itemId) !== Number(listing.itemId)) return false;
        if (Number(flow.price) !== Number(listing.price)) return false;
        if (flow.sellerId > 0 && listing.sellerId > 0 && Number(flow.sellerId) !== Number(listing.sellerId)) return false;
        return normalizedPurchaseText(flow.itemName) === normalizedPurchaseText(listing.itemName);
      }

      function sameBazaarQuickPurchaseIdentity(flow, listing) {
        if (!flow || !listing || flow.kind !== 'bazaar' || listing.kind !== 'bazaar') return false;
        let matched = false;
        const flowItemId = Number(flow.itemId) || 0;
        const listingItemId = Number(listing.itemId) || 0;
        if (flowItemId > 0 && listingItemId > 0) {
          if (flowItemId !== listingItemId) return false;
          matched = true;
        }
        const flowName = normalizedPurchaseText(flow.itemName);
        const listingName = normalizedPurchaseText(listing.itemName);
        if (flowName && listingName) {
          if (flowName !== listingName) return false;
          matched = true;
        }
        const flowHasPrice = flow.price !== null && flow.price !== undefined && flow.price !== '';
        const listingHasPrice = listing.price !== null && listing.price !== undefined && listing.price !== '';
        const flowPrice = Number(flow.price);
        const listingPrice = Number(listing.price);
        if (flowHasPrice && listingHasPrice && Number.isFinite(flowPrice) && Number.isFinite(listingPrice)) {
          if (flowPrice !== listingPrice) return false;
          matched = true;
        }
        return matched;
      }

      function mergedBazaarQuickPurchaseListing(flow, listing) {
        if (!listing) return flow || null;
        const listingHasPrice = listing.price !== null && listing.price !== undefined && listing.price !== '';
        return {
          ...flow,
          ...listing,
          itemId: Number(listing.itemId) > 0 ? listing.itemId : flow?.itemId,
          itemName: listing.itemName || flow?.itemName || '',
          price: listingHasPrice && Number.isFinite(Number(listing.price)) ? listing.price : flow?.price,
          stock: Number(listing.stock) > 0 ? listing.stock : flow?.stock,
        };
      }

      function highlightedQuickPurchaseListing(kind, element) {
        if (!purchaseState.settings.highlightedQuickBuyEnabled || !element?.isConnected) return false;
        if (kind === 'bazaar') {
          return element.hasAttribute('data-tdd-bazaar-targeted')
            || element.hasAttribute('data-tdd-bazaar-one-dollar')
            || element.hasAttribute('data-tdd-bazaar-shop-profit')
            || element.getAttribute('data-tdd-market-dom-test') === 'bazaar';
        }
        return element.hasAttribute('data-tdd-item-market-one-dollar')
          || element.hasAttribute('data-tdd-item-market-shop-profit')
          || element.getAttribute('data-tdd-market-dom-test') === 'item-market';
      }

      function quickPurchaseQuantity(listing) {
        const input = listing.kind === 'bazaar'
          ? bazaarPurchaseQuantityInput({ ...listing, card: listing.element })
          : itemMarketQuantityInput(listing.element);
        const quantity = Math.trunc(Number(String(input?.value || '').replace(/[^\d]/g, '')) || 0);
        return quantity > 0 ? quantity : 0;
      }

      function quickPurchaseConfirmation(flow) {
        if (!flow || Date.now() - Number(flow.startedAt || 0) > QUICK_PURCHASE_FLOW_TIMEOUT_MS) return null;
        const selector = flow.kind === 'bazaar' ? '[data-testid="buy-confirmation"]' : '[class*="confirmWrapper___"]';
        return Array.from(document.querySelectorAll(selector)).find((wrapper) => elementVisible(wrapper) && quickPurchaseConfirmationMatches(wrapper, flow)) || null;
      }

      function quickPurchaseConfirmationMatches(wrapper, flow) {
        const text = normalizedPurchaseText(wrapper?.textContent);
        const itemName = normalizedPurchaseText(flow?.itemName);
        if (!text || !itemName || !text.includes(itemName)) return false;
        const messageId = wrapper.querySelector('[id^="buy-confirmation-msg-"]')?.id || '';
        const messageItemId = Number(messageId.match(/^buy-confirmation-msg-(\d+)-/i)?.[1]) || 0;
        if (messageItemId > 0 && Number(flow.itemId) > 0 && messageItemId !== Number(flow.itemId)) return false;
        const quantity = Math.max(1, Math.trunc(Number(flow.quantity) || 1));
        const expectedTotal = Math.trunc(Number(flow.price) * quantity);
        const displayedTotals = Array.from(String(wrapper.textContent || '').matchAll(/\$\s*([\d,]+)/g), (match) => Number(match[1].replaceAll(',', '')));
        return expectedTotal <= 0 || !displayedTotals.length || displayedTotals.includes(expectedTotal);
      }

      function quickPurchaseYesButton(wrapper, kind) {
        if (!wrapper) return null;
        if (kind === 'bazaar') return wrapper.querySelector('button[aria-label="Yes"]');
        return Array.from(wrapper.querySelectorAll('button')).find((button) => /^yes$/i.test(String(button.textContent || '').trim())) || null;
      }

      function nativeQuickPurchaseControl(element, selector) {
        return Array.from(element?.querySelectorAll?.(selector) || []).find((control) => (
          control.isConnected
          && !control.matches('[data-tdd-quick-buy]')
          && !control.disabled
          && control.getAttribute('aria-disabled') !== 'true'
        )) || null;
      }

      function measurableQuickPurchaseControl(control) {
        if (!control || !elementVisible(control)) return false;
        const rect = control.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0
          && Number.isFinite(rect.left) && Number.isFinite(rect.top);
      }

      function highlightedQuickPurchaseElements(kind) {
        const selector = kind === 'bazaar'
          ? '[data-tdd-bazaar-targeted], [data-tdd-bazaar-one-dollar], [data-tdd-bazaar-shop-profit], [data-tdd-market-dom-test="bazaar"]'
          : '[data-tdd-item-market-one-dollar], [data-tdd-item-market-shop-profit], [data-tdd-market-dom-test="item-market"]';
        return Array.from(document.querySelectorAll(selector));
      }

      function resolvedQuickPurchaseListing(flow) {
        if (!flow) return null;
        if (flow.kind === 'bazaar') {
          const cards = [...new Set([
            flow.element?.isConnected ? flow.element : null,
            ...highlightedQuickPurchaseElements('bazaar'),
            ...bazaarListingCards(),
          ].filter(Boolean))];
          const listing = cards
            .map((element) => quickPurchaseListing('bazaar', element))
            .find((candidate) => sameBazaarQuickPurchaseIdentity(flow, candidate));
          return mergedBazaarQuickPurchaseListing(flow, listing);
        }
        return highlightedQuickPurchaseElements(flow.kind)
          .map((element) => quickPurchaseListing(flow.kind, element))
          .find((listing) => sameQuickPurchaseListing(flow, listing)) || null;
      }

      function quickPurchaseListingControlKey(listing) {
        if (listing.kind === 'bazaar') {
          const identity = Number(listing.itemId) > 0
            ? `item-${Number(listing.itemId)}`
            : `name-${normalizedPurchaseText(listing.itemName)}`;
          return `bazaar:${identity}:price-${Number(listing.price) || 0}`;
        }
        let id = purchaseState.quickPurchaseListingIds.get(listing.element);
        if (!id) {
          id = ++purchaseState.quickPurchaseListingIdCounter;
          purchaseState.quickPurchaseListingIds.set(listing.element, id);
        }
        return `${listing.kind}:${id}`;
      }

      function quickPurchaseAnchor(native, listing) {
        const controlRect = native.getBoundingClientRect();
        const listingRect = listing.element.getBoundingClientRect();
        return {
          offsetLeft: controlRect.left - listingRect.left,
          offsetTop: controlRect.top - listingRect.top,
          viewportLeft: controlRect.left,
          viewportTop: controlRect.top,
          width: controlRect.width,
          height: controlRect.height,
        };
      }

      function desiredFlowStageControl(desired, native, spec, activeFlow) {
        if (!native) return;
        const transitionElapsed = Date.now() - Number(activeFlow.lastActionAt || 0);
        const waitingForNativeTransition = activeFlow?.lastStage === spec.stage && transitionElapsed < 1_500;
        if (waitingForNativeTransition) scheduleQuickPurchaseControlSync(1_500 - transitionElapsed + 20);
        desired.set(activeFlow.controlKey, waitingForNativeTransition
          ? { ...spec, anchor: activeFlow.anchor, controlKey: activeFlow.controlKey, label: 'Wait', disabled: true, passive: true }
          : { ...spec, anchor: activeFlow.anchor, controlKey: activeFlow.controlKey });
      }

      function activeBazaarQuickPurchaseControl(flow, selector) {
        const resolved = resolvedQuickPurchaseListing(flow);
        let native = nativeQuickPurchaseControl(resolved?.element, selector);
        if (native && !measurableQuickPurchaseControl(native)) native = null;
        if (!native) {
          const candidates = Array.from(document.querySelectorAll(selector)).filter((control) => (
            control.isConnected
            && !control.matches('[data-tdd-quick-buy]')
            && !control.disabled
            && control.getAttribute('aria-disabled') !== 'true'
            && measurableQuickPurchaseControl(control)
          ));
          native = candidates.find((control) => {
            const card = bazaarListingCards().find((candidate) => candidate.contains(control));
            return card && sameBazaarQuickPurchaseIdentity(flow, quickPurchaseListing('bazaar', card));
          }) || (candidates.length === 1 ? candidates[0] : null);
        }
        if (!native) return { native: null, listing: resolved || flow };
        const card = bazaarListingCards().find((candidate) => candidate.contains(native))
          || native.closest('[data-testid="item"]');
        const listing = card
          ? mergedBazaarQuickPurchaseListing(flow, quickPurchaseListing('bazaar', card))
          : resolved || flow;
        return { native, listing };
      }

      function desiredBazaarFlowWaitControl(desired, activeFlow, listing) {
        if (!activeFlow?.lastNative) return;
        const elapsed = Date.now() - Number(activeFlow.lastActionAt || activeFlow.startedAt || 0);
        if (elapsed >= QUICK_PURCHASE_TRANSITION_TIMEOUT_MS) {
          purchaseState.quickPurchaseFlow = null;
          return;
        }
        scheduleQuickPurchaseControlSync(QUICK_PURCHASE_TRANSITION_TIMEOUT_MS - elapsed + 20);
        desired.set(activeFlow.controlKey, {
          stage: 'waiting',
          listing: listing || activeFlow,
          native: activeFlow.lastNative,
          anchor: activeFlow.anchor,
          controlKey: activeFlow.controlKey,
          label: 'Wait',
          disabled: true,
          passive: true,
        });
      }

      function desiredQuickPurchaseControls() {
        const desired = new Map();
        if (!purchaseState.settings.highlightedQuickBuyEnabled) return desired;
        const flow = purchaseState.quickPurchaseFlow;
        if (flow && Date.now() - Number(flow.startedAt || 0) > QUICK_PURCHASE_FLOW_TIMEOUT_MS) purchaseState.quickPurchaseFlow = null;
        const activeFlow = purchaseState.quickPurchaseFlow;
        const confirmation = quickPurchaseConfirmation(activeFlow);
        if (confirmation) {
          const yes = quickPurchaseYesButton(confirmation, activeFlow.kind);
          if (yes && !yes.disabled) {
            const sending = Date.now() - Number(activeFlow.confirmationSentAt || 0) < 2_000;
            desired.set(activeFlow.controlKey, {
              stage: 'confirm',
              listing: resolvedQuickPurchaseListing(activeFlow) || activeFlow,
              native: yes,
              anchor: activeFlow.anchor,
              controlKey: activeFlow.controlKey,
              label: sending ? 'Sending' : 'Yes',
              disabled: sending,
            });
          } else if (activeFlow.kind === 'bazaar') {
            desiredBazaarFlowWaitControl(desired, activeFlow, resolvedQuickPurchaseListing(activeFlow));
          }
          return desired;
        }

        if (activeFlow) {
          if (activeFlow.kind === 'bazaar') {
            const buyControl = activeBazaarQuickPurchaseControl(activeFlow, 'button[data-testid="buy-button"]');
            const activateControl = activeBazaarQuickPurchaseControl(activeFlow, 'button[data-testid="activate-buy-button"]');
            if (buyControl.native) desiredFlowStageControl(desired, buyControl.native, {
              stage: 'buy',
              listing: buyControl.listing,
              native: buyControl.native,
              label: 'Buy max',
            }, activeFlow);
            else if (activateControl.native) desiredFlowStageControl(desired, activateControl.native, {
              stage: 'open',
              listing: activateControl.listing,
              native: activateControl.native,
              label: 'Buy',
            }, activeFlow);
            else desiredBazaarFlowWaitControl(desired, activeFlow, resolvedQuickPurchaseListing(activeFlow));
          } else {
            const listing = resolvedQuickPurchaseListing(activeFlow);
            if (!listing) return desired;
            const buy = nativeQuickPurchaseControl(listing.element, 'button[class*="buyButton___"], button[aria-label^="Buy "]');
            if (buy) desiredFlowStageControl(desired, buy, { stage: 'buy', listing, native: buy, label: 'Buy max' }, activeFlow);
          }
          return desired;
        }

        bazaarListingCards().forEach((element) => {
          if (!highlightedQuickPurchaseListing('bazaar', element)) return;
          const listing = quickPurchaseListing('bazaar', element);
          const buyCandidate = nativeQuickPurchaseControl(element, 'button[data-testid="buy-button"]');
          const activateCandidate = nativeQuickPurchaseControl(element, 'button[data-testid="activate-buy-button"]');
          const buy = measurableQuickPurchaseControl(buyCandidate) ? buyCandidate : null;
          const activate = measurableQuickPurchaseControl(activateCandidate) ? activateCandidate : null;
          const native = buy || activate;
          const controlKey = quickPurchaseListingControlKey(listing);
          const existingButton = purchaseState.quickPurchaseOverlays.get(controlKey);
          const existingSpec = existingButton ? purchaseState.quickPurchaseControlSpecs.get(existingButton) : null;
          if (!native && !existingSpec) return;
          desired.set(controlKey, {
            stage: buy ? 'buy' : activate ? 'open' : existingSpec.stage,
            listing,
            native: native || existingSpec.native,
            anchor: native ? quickPurchaseAnchor(native, listing) : existingSpec.anchor,
            controlKey,
            label: buy ? 'Buy max' : activate ? 'Buy' : existingSpec.label,
          });
        });
        highlightedQuickPurchaseElements('item-market').forEach((element) => {
          const listing = quickPurchaseListing('item-market', element);
          const native = nativeQuickPurchaseControl(element, 'button[class*="buyButton___"], button[aria-label^="Buy "]');
          if (!native) return;
          const controlKey = quickPurchaseListingControlKey(listing);
          desired.set(controlKey, {
            stage: 'buy',
            listing,
            native,
            anchor: quickPurchaseAnchor(native, listing),
            controlKey,
            label: 'Buy max',
          });
        });
        return desired;
      }

      function ensureQuickPurchaseLayer() {
        let layer = document.getElementById('tdd-quick-buy-layer');
        if (layer) return layer;
        layer = document.createElement('div');
        layer.id = 'tdd-quick-buy-layer';
        layer.setAttribute('aria-label', 'Highlighted listing quick-buy controls');
        document.body?.appendChild(layer);
        document.querySelectorAll('[data-tdd-quick-buy-native]').forEach((native) => native.removeAttribute('data-tdd-quick-buy-native'));
        return layer;
      }

      function setQuickPurchaseButtonStyle(button, property, value) {
        if (button.style[property] !== value) button.style[property] = value;
      }

      function positionQuickPurchaseButton(button, spec) {
        const listingElement = spec.listing.element;
        const useListingPosition = listingElement?.isConnected
          && (spec.listing.kind !== 'bazaar' || elementVisible(listingElement));
        const listingRect = useListingPosition ? listingElement.getBoundingClientRect() : null;
        const left = listingRect ? listingRect.left + Number(spec.anchor.offsetLeft || 0) : Number(spec.anchor.viewportLeft || 0);
        const top = listingRect ? listingRect.top + Number(spec.anchor.offsetTop || 0) : Number(spec.anchor.viewportTop || 0);
        const width = Math.max(1, Number(spec.anchor.width) || spec.native.getBoundingClientRect().width || 1);
        const height = Math.max(1, Number(spec.anchor.height) || spec.native.getBoundingClientRect().height || 1);
        const hidden = left + width < 0 || top + height < 0 || left > innerWidth || top > innerHeight;
        setQuickPurchaseButtonStyle(button, 'display', hidden ? 'none' : 'block');
        setQuickPurchaseButtonStyle(button, 'left', `${Math.round(left * 10) / 10}px`);
        setQuickPurchaseButtonStyle(button, 'top', `${Math.round(top * 10) / 10}px`);
        setQuickPurchaseButtonStyle(button, 'width', `${Math.round(width * 10) / 10}px`);
        setQuickPurchaseButtonStyle(button, 'height', `${Math.round(height * 10) / 10}px`);
      }

      function clearQuickPurchaseControls({ resetFlow = true } = {}) {
        if (purchaseState.bazaarOneDollarTimer) window.clearTimeout(purchaseState.bazaarOneDollarTimer);
        purchaseState.bazaarOneDollarTimer = null;
        if (purchaseState.quickPurchaseSyncTimer) window.clearTimeout(purchaseState.quickPurchaseSyncTimer);
        purchaseState.quickPurchaseSyncTimer = null;
        purchaseState.quickPurchaseOverlays.forEach((button) => button.remove());
        purchaseState.quickPurchaseOverlays.clear();
        document.getElementById('tdd-quick-buy-layer')?.remove();
        if (resetFlow) purchaseState.quickPurchaseFlow = null;
      }

      function syncHighlightedQuickPurchaseControls() {
        if (!focusedTornPage()) return;
        if (!onPurchaseOpportunityPage() && !purchaseState.quickPurchaseFlow) {
          clearQuickPurchaseControls();
          return;
        }
        const desired = desiredQuickPurchaseControls();
        const now = Date.now();
        purchaseState.quickPurchaseOverlays.forEach((button, controlKey) => {
          if (desired.has(controlKey) && button.isConnected) return;
          const previous = purchaseState.quickPurchaseControlSpecs.get(button);
          const lastSeenAt = Number(button.dataset.tddQuickBuySeenAt) || 0;
          const bazaarGraceRemaining = previous?.listing?.kind === 'bazaar' ? 900 - (now - lastSeenAt) : 0;
          if (bazaarGraceRemaining > 0 && button.isConnected) {
            scheduleQuickPurchaseControlSync(Math.max(40, bazaarGraceRemaining));
            return;
          }
          button.remove();
          purchaseState.quickPurchaseOverlays.delete(controlKey);
        });
        if (!desired.size && !purchaseState.quickPurchaseOverlays.size) {
          document.getElementById('tdd-quick-buy-layer')?.remove();
          return;
        }
        const layer = desired.size ? ensureQuickPurchaseLayer() : document.getElementById('tdd-quick-buy-layer');
        if (!layer) return;
        desired.forEach((spec, controlKey) => {
          let button = purchaseState.quickPurchaseOverlays.get(controlKey);
          if (!button?.isConnected) {
            button = document.createElement('button');
            button.type = 'button';
            button.setAttribute('data-tdd-quick-buy', 'true');
            layer.appendChild(button);
            purchaseState.quickPurchaseOverlays.set(controlKey, button);
          }
          const ariaLabel = `${spec.label}: ${spec.listing.itemName}`;
          if (button.dataset.tddQuickBuyStage !== spec.stage) button.dataset.tddQuickBuyStage = spec.stage;
          if (button.textContent !== spec.label) button.textContent = spec.label;
          if (button.disabled !== (spec.disabled === true)) button.disabled = spec.disabled === true;
          if (spec.passive === true) button.dataset.tddQuickBuyPassive = 'true';
          else button.removeAttribute('data-tdd-quick-buy-passive');
          if (button.getAttribute('aria-label') !== ariaLabel) button.setAttribute('aria-label', ariaLabel);
          button.dataset.tddQuickBuySeenAt = String(now);
          positionQuickPurchaseButton(button, spec);
          purchaseState.quickPurchaseControlSpecs.set(button, spec);
        });
      }

      function scheduleQuickPurchaseControlSync(delay = 40) {
        if (!focusedTornPage()) return;
        if (!onPurchaseOpportunityPage() && !purchaseState.quickPurchaseFlow && !purchaseState.quickPurchaseOverlays.size) return;
        if (purchaseState.quickPurchaseSyncTimer) return;
        purchaseState.quickPurchaseSyncTimer = window.setTimeout(() => {
          purchaseState.quickPurchaseSyncTimer = null;
          syncHighlightedQuickPurchaseControls();
        }, delay);
      }

      function refreshPurchaseOpportunityFormattingAfterClick(delay) {
        window.setTimeout(() => {
          formatBazaarOneDollarListings();
          formatItemMarketPurchaseOpportunities();
          syncHighlightedQuickPurchaseControls();
        }, delay);
      }

      function handleHighlightedQuickPurchaseClick(event) {
        const button = event.target?.closest?.('button[data-tdd-quick-buy]');
        if (!button) return;
        event.preventDefault();
        event.stopImmediatePropagation();
        const spec = purchaseState.quickPurchaseControlSpecs.get(button);
        if (!event.isTrusted || !purchaseState.settings.highlightedQuickBuyEnabled || !focusedTornPage()) return;
        if (spec?.passive) return;
        if (!spec?.native?.isConnected || spec.native.disabled || spec.native.getAttribute('aria-disabled') === 'true') return;
        const listing = spec.listing;
        if (spec.stage === 'confirm') {
          const flow = purchaseState.quickPurchaseFlow;
          const wrapper = spec.native.closest('[data-testid="buy-confirmation"], [class*="confirmWrapper___"]');
          const sameListing = flow?.kind === 'bazaar'
            ? sameBazaarQuickPurchaseIdentity(flow, listing)
            : sameQuickPurchaseListing(flow, listing);
          if (!sameListing || !quickPurchaseConfirmationMatches(wrapper, flow)) return;
          button.disabled = true;
          button.textContent = 'Sending';
          const sentAt = Date.now();
          purchaseState.quickPurchaseFlow = { ...flow, confirmationSentAt: sentAt };
          spec.native.click();
          refreshPurchaseOpportunityFormattingAfterClick(80);
          refreshPurchaseOpportunityFormattingAfterClick(300);
          window.setTimeout(() => {
            if (purchaseState.quickPurchaseFlow?.confirmationSentAt === sentAt) purchaseState.quickPurchaseFlow = null;
            refreshPurchaseOpportunityFormattingAfterClick(0);
          }, 2_050);
          return;
        }
        const continuingFlow = purchaseState.quickPurchaseFlow?.controlKey === spec.controlKey;
        if (!continuingFlow && !highlightedQuickPurchaseListing(listing.kind, listing.element)) return;
        if (spec.stage === 'buy') {
          if (listing.kind === 'bazaar') {
            const currentCard = bazaarListingCards().find((candidate) => candidate.contains(spec.native))
              || spec.native.closest('[data-testid="item"]')
              || listing.element;
            const currentListing = mergedBazaarQuickPurchaseListing(listing, quickPurchaseListing('bazaar', currentCard));
            const pending = {
              ...currentListing,
              card: currentCard,
              clickedAt: Date.now(),
            };
            purchaseState.pendingBazaarPurchase = pending;
            fillBazaarPurchaseMaximum(pending);
            Object.assign(listing, currentListing);
          } else {
            fillItemMarketPurchaseMaximum(listing.element, listing.price);
          }
          listing.quantity = quickPurchaseQuantity(listing);
          if (listing.quantity < 1) return;
        }
        const now = Date.now();
        purchaseState.quickPurchaseFlow = {
          ...listing,
          anchor: spec.anchor,
          controlKey: spec.controlKey,
          startedAt: Number(purchaseState.quickPurchaseFlow?.startedAt) || now,
          lastActionAt: now,
          lastStage: spec.stage,
          lastNative: spec.native,
        };
        button.disabled = true;
        button.textContent = 'Opening';
        spec.native.click();
        refreshPurchaseOpportunityFormattingAfterClick(40);
        refreshPurchaseOpportunityFormattingAfterClick(160);
        refreshPurchaseOpportunityFormattingAfterClick(450);
        window.setTimeout(() => {
          const currentFlow = purchaseState.quickPurchaseFlow;
          if (currentFlow?.lastActionAt === now) {
            const listingNow = resolvedQuickPurchaseListing(currentFlow);
            const advancedToBuy = currentFlow.lastStage === 'open'
              && (currentFlow.kind === 'bazaar'
                ? activeBazaarQuickPurchaseControl(currentFlow, 'button[data-testid="buy-button"]').native
                : nativeQuickPurchaseControl(listingNow?.element, 'button[data-testid="buy-button"]'));
            if (!advancedToBuy && !quickPurchaseConfirmation(currentFlow)) purchaseState.quickPurchaseFlow = null;
          }
          refreshPurchaseOpportunityFormattingAfterClick(0);
        }, 1_650);
      }

      function handleBazaarPurchaseClick(event) {
        if (!focusedTornPage() || !onBazaarPage()) return;
        const control = event.target?.closest?.('button, [role="button"]');
        if (control?.matches?.('[data-tdd-quick-buy]')) return;
        if (!bazaarPurchaseButton(control)) return;
        const card = bazaarListingCards().find((candidate) => candidate.contains(control));
        if (!card || bazaarCardUnavailable(card)) return;
        const pending = {
          card,
          itemId: bazaarCardItemId(card),
          price: bazaarCardPrice(card),
          stock: bazaarCardStock(card),
          clickedAt: Date.now(),
        };
        purchaseState.pendingBazaarPurchase = pending;
        [0, 60, 180, 420, 900, 1_500].forEach((delay) => window.setTimeout(() => {
          fillBazaarPurchaseMaximum(pending);
          if (delay === 1_500 && purchaseState.pendingBazaarPurchase === pending) purchaseState.pendingBazaarPurchase = null;
        }, delay));
      }

      function schedulePurchaseOpportunityFormatting(delay = 200) {
        if (!focusedTornPage() || !onPurchaseOpportunityPage()) return;
        if (purchaseState.bazaarOneDollarTimer) return;
        purchaseState.bazaarOneDollarTimer = window.setTimeout(() => {
          purchaseState.bazaarOneDollarTimer = null;
          formatBazaarOneDollarListings();
          formatItemMarketPurchaseOpportunities();
          syncHighlightedQuickPurchaseControls();
        }, delay);
      }

      function clearPurchaseOpportunityFormatting() {
        if (purchaseState.bazaarOneDollarTimer) global.clearTimeout(purchaseState.bazaarOneDollarTimer);
        if (purchaseState.quickPurchaseSyncTimer) global.clearTimeout(purchaseState.quickPurchaseSyncTimer);
        purchaseState.bazaarOneDollarTimer = null;
        purchaseState.quickPurchaseSyncTimer = null;
        clearQuickPurchaseControls();
        purchaseState.quickPurchaseFlow = null;
        purchaseState.pendingBazaarPurchase = null;
        const attributes = [
          'data-tdd-bazaar-targeted', 'data-tdd-bazaar-one-dollar', 'data-tdd-bazaar-shop-profit',
          'data-tdd-item-market-one-dollar', 'data-tdd-item-market-shop-profit', 'data-tdd-item-market-max-applied',
          'data-tdd-purchase-reason', 'data-tdd-market-dom-test'
        ];
        for (const attribute of attributes) document.querySelectorAll(`[${attribute}]`).forEach(node => node.removeAttribute(attribute));
        document.getElementById('tdd-purchase-highlight-styles')?.remove();
      }

      function aggregateShare(opportunities) {
        return opportunities.slice(0, 12).map(row => row.shareText).join('\n');
      }

      function marketShareKey(id) {
        return `market:${String(id || '')}`;
      }

      function updateShareButtons(root) {
        const all = root.querySelector('[data-market-send-all]');
        if (all) all.disabled = !SLINK.core.factionChat.isPrimed(marketShareKey('all'));
        root.querySelectorAll('[data-market-send]').forEach(button => {
          button.disabled = !SLINK.core.factionChat.isPrimed(marketShareKey(button.dataset.marketSend));
          button.title = button.disabled ? 'Copy this listing first to unlock sending' : 'Send the copied listing to Faction Chat';
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
        syncPurchaseCatalog(status);
        updateStatus();
        const deals = Array.isArray(status?.opportunities) ? status.opportunities : [];
        ui.setAlertCount('market', deals.length, { group:'efficiency', label:'active Market Watch deals' });
        const root = ui.getContentElement();
        root.innerHTML = `<div class="slink-market-summary"><div><strong>${status?.activeWatchCount || 0}/${status?.marketWatchLimit || 0}</strong><small>Active · ${status?.savedWatchCount || 0} saved</small></div><div><strong>${deals.length}</strong><small>Deals</small></div><div><strong data-slink-api-usage>${status?.tornApiUsage?.count || 0}/${status?.tornApiUsage?.limit || 60}</strong><small>API / min</small></div></div>
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
          const result = await SLINK.core.factionChat.prime(aggregateShare(deals), { key:marketShareKey('all') });
          copyAll.textContent = result.ok ? 'List copied' : result.label;
          updateShareButtons(root);
        });
        sendAll?.addEventListener('click', async () => {
          sendAll.disabled = true; sendAll.textContent = 'Sending…';
          const result = await SLINK.core.factionChat.sendPrimed({ key:marketShareKey('all') });
          sendAll.textContent = result.label;
          updateShareButtons(root);
        });
        root.querySelectorAll('[data-market-copy]').forEach(button => button.addEventListener('click', async () => {
          const row = deals.find(item => item.id === button.dataset.marketCopy);
          const result = row ? await SLINK.core.factionChat.prime(row.shareText, { key:marketShareKey(row.id) }) : { ok:false, label:'Copy failed' };
          button.textContent = result.label;
          updateShareButtons(root);
        }));
        root.querySelectorAll('[data-market-send]').forEach(button => button.addEventListener('click', async () => {
          const row = deals.find(item => item.id === button.dataset.marketSend);
          if (!row) return;
          button.disabled = true; button.textContent = 'Sending…';
          const result = await SLINK.core.factionChat.sendPrimed({ key:marketShareKey(row.id) });
          button.textContent = result.label;
          updateShareButtons(root);
        }));
        root.querySelectorAll('[data-market-dismiss]').forEach(button => button.addEventListener('click', async () => {
          const row = deals.find(item => item.id === button.dataset.marketDismiss);
          if (!row) return;
          button.disabled = true; button.textContent = 'Dismissing…';
          render(await SLINK.core.messaging.send('market.deal.dismiss', { dismissKey:row.dismissKey }));
        }));
        updateShareButtons(root);
        schedulePurchaseOpportunityFormatting(0);
      }

      async function load(refreshIfDue = true) {
        try { render(await SLINK.core.messaging.send('market.status', { refreshIfDue })); await claimMarketSound(); }
        catch (error) { ui.setStatus(SLINK.core.format.errorMessage(error), 'error'); }
      }

      const marketActions = [
        { id:'refresh', label:'Refresh', onClick:async event => { event.currentTarget.disabled = true; try { await touchMarketActivity(true); render(await SLINK.core.messaging.send('market.refresh')); } catch (error) { ui.setStatus(SLINK.core.format.errorMessage(error), 'error'); } finally { event.currentTarget.disabled = false; } } },
        { id:'permissions', label:'Refresh permissions', onClick:async event => { event.currentTarget.disabled = true; try { await touchMarketActivity(true); render(await SLINK.core.messaging.send('market.permissions.refresh')); } catch (error) { ui.setStatus(SLINK.core.format.errorMessage(error), 'error'); } finally { event.currentTarget.disabled = false; } } },
        { id:'settings', label:'Settings', onClick:async () => { await touchMarketActivity(true); return SLINK.core.messaging.send('ui.dashboard.open', { page:'alerts', efficiencyView:'market' }); } }
      ];
      if (marketDomTestAllowed) marketActions.push({
        id:'dom-test',
        label:'Market DOM Test',
        onClick:event => {
          purchaseState.domTestEnabled = !purchaseState.domTestEnabled;
          event.currentTarget.textContent = purchaseState.domTestEnabled ? 'Stop DOM Test' : 'Market DOM Test';
          clearMarketDomTestMarks();
          schedulePurchaseOpportunityFormatting(0);
        }
      });
      ui.setActions(marketActions);
      observer = new MutationObserver(() => schedulePurchaseOpportunityFormatting(80));
      observer.observe(document.body, { childList:true, subtree:true });
      global.addEventListener('hashchange', schedulePurchaseOpportunityFormatting);
      global.addEventListener('popstate', schedulePurchaseOpportunityFormatting);
      global.addEventListener('resize', scheduleQuickPurchaseControlSync);
      global.addEventListener('scroll', scheduleQuickPurchaseControlSync, true);
      document.addEventListener('click', handleHighlightedQuickPurchaseClick, true);
      document.addEventListener('click', handleBazaarPurchaseClick, true);
      await load(false);
      global.addEventListener('slink:api-usage', updateApiUsage);
      moduleView = ui.getContentElement()?.closest('.module-view') || null;
      if (moduleView) {
        visibilityObserver = new MutationObserver(syncMarketVisibility);
        visibilityObserver.observe(moduleView, { attributes:true, attributeFilter:['hidden'] });
        moduleView.addEventListener('click', noteMarketInteraction, true);
        moduleView.addEventListener('input', noteMarketInteraction, true);
        moduleView.addEventListener('change', noteMarketInteraction, true);
      }
      syncMarketVisibility();
      timer = global.setInterval(() => {
        if (!stopped && moduleVisible() && Date.now() - lastActivityTouchAt <= INACTIVE_AFTER_MS) void load(true);
      }, 5_000);
      clockTimer = global.setInterval(() => { if (!stopped) updateStatus(); }, 1_000);
      return { stop() { stopped = true; observer?.disconnect(); visibilityObserver?.disconnect(); if (timer) global.clearInterval(timer); if (clockTimer) global.clearInterval(clockTimer); moduleView?.removeEventListener('click', noteMarketInteraction, true); moduleView?.removeEventListener('input', noteMarketInteraction, true); moduleView?.removeEventListener('change', noteMarketInteraction, true); global.removeEventListener('slink:api-usage', updateApiUsage); global.removeEventListener('hashchange', schedulePurchaseOpportunityFormatting); global.removeEventListener('popstate', schedulePurchaseOpportunityFormatting); global.removeEventListener('resize', scheduleQuickPurchaseControlSync); global.removeEventListener('scroll', scheduleQuickPurchaseControlSync, true); document.removeEventListener('click', handleHighlightedQuickPurchaseClick, true); document.removeEventListener('click', handleBazaarPurchaseClick, true); ui.setAlertCount('market', 0); clearPurchaseOpportunityFormatting(); } };
    }
  });
})(globalThis);

