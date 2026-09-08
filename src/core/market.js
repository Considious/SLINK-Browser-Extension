(function installMarketCore(global) {
  'use strict';

  const SLINK = global.SLINK_EXTENSION;
  if (!SLINK) throw new Error('SLINK runtime must load before Market Watch helpers.');

  const PRIORITIES = Object.freeze({ high:0, normal:1, low:2 });
  const TORN_PRIORITY_LIMITS = Object.freeze({ high:60, normal:50, low:40 });
  const WEAVER_REFRESH_MS = Object.freeze({ high:35_000, normal:70_000, low:140_000 });
  const ITEM_MARKET_FALLBACK_MS = 30_000;
  const ITEM_MARKET_CACHE_SAFETY_MS = 1_000;
  const ITEM_MARKET_STALE_RETRY_MIN_MS = 2_000;
  const ITEM_MARKET_STALE_RETRY_MAX_MS = 5_000;
  const POINTS_MARKET_REFRESH_MS = 30_000;
  const WEAVER_RATE_LIMIT = 80;
  const WEAVER_RATE_WINDOW_MS = 60_000;
  const WEAVER_MIN_REQUEST_SPACING_MS = Math.ceil(WEAVER_RATE_WINDOW_MS / WEAVER_RATE_LIMIT);
  const WEAVER_FALLBACK_BACKOFF_MS = 15 * 60_000;

  function finite(value) {
    if (value === null || value === undefined || value === '') return null;
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
  }

  function normalizePriority(value) {
    return Object.hasOwn(PRIORITIES, value) ? String(value) : 'normal';
  }

  function defaultSettings() {
    return { enabled:true, showInTorn:true, quickBuyEnabled:true, lastPriority:'normal', watches:[] };
  }

  function normalizeWatch(input = {}, index = 0) {
    const marketType = input?.marketType === 'points' ? 'points' : 'item';
    const itemId = marketType === 'item' ? Math.max(0, Math.trunc(Number(input?.itemId) || 0)) : 0;
    return {
      uid:String(input?.uid || `watch-${Date.now()}-${index}`).slice(0, 100),
      marketType,
      itemId,
      label:marketType === 'points' ? 'Points' : String(input?.label || '').trim().slice(0, 120),
      maxPrice:Math.max(0, Math.trunc(Number(input?.maxPrice) || 0)),
      priority:normalizePriority(input?.priority),
      marketEnabled:marketType === 'points' ? true : input?.marketEnabled !== false,
      bazaarEnabled:marketType === 'item' && input?.bazaarEnabled !== false,
      enabled:input?.enabled !== false
    };
  }

  function normalizeSettings(input = {}) {
    const defaults = defaultSettings();
    return {
      ...defaults,
      ...(input && typeof input === 'object' ? input : {}),
      enabled:input?.enabled !== false,
      showInTorn:input?.showInTorn !== false,
      quickBuyEnabled:input?.quickBuyEnabled !== false,
      lastPriority:normalizePriority(input?.lastPriority),
      watches:(Array.isArray(input?.watches) ? input.watches : []).map(normalizeWatch)
    };
  }

  function shopSellDetails(item = {}) {
    const shops = Array.isArray(item?.value?.shops) ? item.value.shops : [];
    const candidates = shops.map(shop => ({
      price:finite(shop?.sell_price), shop:String(shop?.shop || '').trim(), country:String(shop?.country || '').trim()
    })).filter(row => row.price !== null && row.price > 0);
    if (candidates.length) return candidates.sort((left, right) => right.price - left.price)[0];
    const legacy = finite(item?.value?.sell_price);
    return legacy !== null && legacy > 0
      ? { price:legacy, shop:String(item?.value?.vendor?.name || 'Torn shop'), country:String(item?.value?.vendor?.country || '') }
      : { price:0, shop:'', country:'' };
  }

  function catalogItems(body = {}) {
    const rows = Array.isArray(body?.items) ? body.items : Object.values(body?.items || {});
    return rows.filter(item => Number(item?.id) > 0 && item?.name && item?.is_tradable !== false && item?.is_masked !== true)
      .map(item => {
        const sell = shopSellDetails(item);
        return {
          id:Math.trunc(Number(item.id)), name:String(item.name), type:String(item.type || 'Other'), image:String(item.image || ''),
          marketPrice:Math.max(0, Math.trunc(Number(item?.value?.market_price) || 0)),
          shopSellPrice:Math.max(0, Math.trunc(Number(sell.price) || 0)), shopSellName:sell.shop, shopSellCountry:sell.country
        };
      }).sort((left, right) => left.name.localeCompare(right.name));
  }

  function itemMarketListings(body = {}) {
    const market = body?.itemmarket || body?.data?.itemmarket || body;
    const rows = Array.isArray(market?.listings) ? market.listings : [];
    return rows.map(row => ({
      price:Math.max(0, Math.trunc(Number(row?.price) || 0)),
      quantity:Math.max(0, Math.trunc(Number(row?.amount ?? row?.quantity) || 0))
    })).filter(row => row.price > 0).sort((left, right) => left.price - right.price);
  }

  function itemMarketCache(body = {}) {
    const market = body?.itemmarket || body?.data?.itemmarket || body;
    const cacheTimestamp = Math.max(0, Math.trunc(Number(market?.cache_timestamp) || 0));
    const delaySeconds = Number(market?.cache_delay);
    return { cacheTimestamp, cacheDelayMs:Number.isFinite(delaySeconds) && delaySeconds >= 0 ? Math.ceil(delaySeconds * 1_000) : null };
  }

  function itemMarketNextCheckAt(result = {}) {
    const stored = Number(result?.nextCheckAt) || 0;
    if (stored > 0) return stored;
    const fetchedAt = Number(result?.fetchedAt) || 0;
    if (!fetchedAt) return 0;
    const timestamp = Number(result?.cacheTimestamp) || 0;
    const delayMs = Number(result?.cacheDelayMs);
    return timestamp > 0 && Number.isFinite(delayMs) && delayMs >= 0
      ? Math.max(timestamp * 1_000 + delayMs + ITEM_MARKET_CACHE_SAFETY_MS, fetchedAt + ITEM_MARKET_CACHE_SAFETY_MS)
      : fetchedAt + ITEM_MARKET_FALLBACK_MS;
  }

  function staleRetryMs(result = {}) {
    const count = Math.max(1, Math.trunc(Number(result?.cacheRetryCount) || 1));
    return Math.min(ITEM_MARKET_STALE_RETRY_MAX_MS, ITEM_MARKET_STALE_RETRY_MIN_MS + (count - 1) * 1_000);
  }

  function pointsMarketListings(body = {}) {
    const market = body?.pointsmarket || body?.data?.pointsmarket || body;
    const rows = Array.isArray(market?.listings) ? market.listings : Array.isArray(market) ? market : Object.values(market?.listings || market || {});
    return rows.map(row => ({
      price:Math.max(0, Math.trunc(Number(row?.cost ?? row?.price ?? row?.price_per_point ?? row?.pricePerPoint) || 0)),
      quantity:Math.max(0, Math.trunc(Number(row?.quantity ?? row?.amount ?? row?.points) || 0))
    })).filter(row => row.price > 0).sort((left, right) => left.price - right.price);
  }

  function effectivePriority(watch = {}, result = {}) {
    if (watch?.marketType === 'points') return 'high';
    const cheapest = Array.isArray(result?.listings) ? Number(result.listings[0]?.price) : 0;
    return cheapest > 0 && Number(watch?.maxPrice) > 0 && cheapest <= Number(watch.maxPrice)
      ? 'high'
      : normalizePriority(watch?.priority);
  }

  function externalTimestampMs(value) {
    const numeric = Number(value);
    if (Number.isFinite(numeric) && numeric > 0) return numeric > 10_000_000_000 ? numeric : numeric * 1000;
    const parsed = Date.parse(String(value || ''));
    return Number.isFinite(parsed) ? parsed : 0;
  }

  function weaverRows(body = {}) {
    const candidates = [body?.listings, body?.bazaarListings, body?.bazaar_listings, body?.marketplace?.listings, body?.item?.listings, body?.data?.listings, body?.data?.bazaarListings, body?.data?.bazaar_listings, body];
    return candidates.find(Array.isArray) || [];
  }

  function weaverListings(body = {}, itemId = 0) {
    return weaverRows(body).map(row => {
      const nested = row?.listing && typeof row.listing === 'object' ? row.listing : row?.bazaar && typeof row.bazaar === 'object' ? row.bazaar : row?.offer && typeof row.offer === 'object' ? row.offer : null;
      const source = nested ? { ...row, ...nested } : row;
      const seller = source?.seller || source?.player || source?.user || source?.owner || {};
      const sellerId = Math.trunc(Number(source?.sellerId ?? source?.seller_id ?? source?.playerId ?? source?.player_id ?? source?.userId ?? source?.user_id ?? seller?.id ?? seller?.playerId ?? seller?.userId));
      const price = Math.trunc(Number(source?.price ?? source?.cost ?? source?.priceEach ?? source?.price_each ?? source?.price_per_item ?? source?.pricePerUnit));
      if (!(sellerId > 0) || !(price > 0)) return null;
      const quantity = Math.max(0, Math.trunc(Number(source?.quantity ?? source?.amount ?? source?.stock ?? source?.available ?? source?.item_count) || 0));
      const sellerName = String(source?.sellerName ?? source?.seller_name ?? source?.playerName ?? source?.player_name ?? source?.userName ?? source?.user_name ?? seller?.name ?? `Player ${sellerId}`).trim() || `Player ${sellerId}`;
      const updatedAt = externalTimestampMs(source?.lastUpdatedAt ?? source?.last_updated_at ?? source?.updatedAt ?? source?.updated_at ?? source?.lastChecked ?? source?.timestamp);
      return { sellerId, sellerName, price, quantity, updatedAt, href:bazaarUrl(sellerId, itemId, price, updatedAt) };
    }).filter(Boolean).sort((left, right) => left.price - right.price);
  }

  function itemMarketUrl(itemId, price = 0) {
    const target = Math.max(0, Math.trunc(Number(itemId) || 0));
    const threshold = Math.max(0, Math.trunc(Number(price) || 0));
    return `https://www.torn.com/page.php?sid=ItemMarket#/market/view=search&itemID=${encodeURIComponent(target)}${threshold ? `&slinkPrice=${encodeURIComponent(threshold)}` : ''}`;
  }

  function pointsMarketUrl() {
    return 'https://www.torn.com/pmarket.php';
  }

  function bazaarUrl(sellerId, itemId, price, updatedAt = 0) {
    const url = new URL('https://www.torn.com/bazaar.php');
    url.searchParams.set('userId', String(Math.trunc(Number(sellerId))));
    url.searchParams.set('itemId', String(Math.trunc(Number(itemId))));
    url.searchParams.set('price', String(Math.trunc(Number(price))));
    url.searchParams.set('slinkHighlight', '1');
    if (Number(updatedAt) > 0) url.searchParams.set('v', String(Math.trunc(Number(updatedAt) / 1000)));
    url.hash = '/';
    return url.toString();
  }

  function formatMoney(value) {
    return `$${Math.max(0, Math.trunc(Number(value) || 0)).toLocaleString('en-US')}`;
  }

  function opportunityRows(runtime = {}, settingsInput = {}) {
    const settings = normalizeSettings(settingsInput);
    const catalog = new Map((Array.isArray(runtime?.catalog?.items) ? runtime.catalog.items : []).map(item => [Number(item.id), item]));
    return settings.watches.flatMap(watch => {
      if (!watch.enabled || !(watch.maxPrice > 0)) return [];
      const result = runtime?.results?.[watch.uid] || {};
      if (watch.marketType === 'points') {
        const listing = Array.isArray(result.points?.listings) ? result.points.listings[0] : null;
        if (!listing || listing.price > watch.maxPrice) return [];
        const href = pointsMarketUrl();
        return [{
          id:`points:${watch.uid}`, watchUid:watch.uid, source:'Points Market', itemId:0, itemName:'Points',
          price:listing.price, quantity:listing.quantity, maxPrice:watch.maxPrice, shopSellPrice:0, shopSellName:'', href,
          detail:`${formatMoney(listing.price)} per point${listing.quantity > 0 ? ` × ${listing.quantity.toLocaleString('en-US')} points` : ''} · target ${formatMoney(watch.maxPrice)}`,
          shareText:`Points Market | ${formatMoney(listing.price)} per point${listing.quantity > 0 ? ` x ${listing.quantity.toLocaleString('en-US')} points` : ''} | target ${formatMoney(watch.maxPrice)} | <a href="${href}">Open Points Market</a>`
        }];
      }
      if (!(watch.itemId > 0)) return [];
      const item = catalog.get(watch.itemId) || {};
      const name = watch.label || item.name || `Item ${watch.itemId}`;
      const sellText = Number(item.shopSellPrice) > 0 ? `${formatMoney(item.shopSellPrice)}${item.shopSellName ? ` at ${item.shopSellName}` : ''}` : '';
      const rows = [];
      const market = Array.isArray(result.market?.listings) ? result.market.listings[0] : null;
      if (watch.marketEnabled && market && market.price <= watch.maxPrice) {
        const href = itemMarketUrl(watch.itemId, market.price);
        rows.push({
          id:`market:${watch.uid}`, watchUid:watch.uid, source:'Item Market', itemId:watch.itemId, itemName:name,
          price:market.price, quantity:market.quantity, maxPrice:watch.maxPrice,
          shopSellPrice:Number(item.shopSellPrice) || 0, shopSellName:item.shopSellName || '', href,
          detail:`${formatMoney(market.price)}${market.quantity > 0 ? ` × ${market.quantity.toLocaleString('en-US')}` : ''} · target ${formatMoney(watch.maxPrice)}${sellText ? ` · shop sells ${sellText}` : ''}`,
          shareText:`Item Market | ${name} | ${formatMoney(market.price)}${market.quantity > 0 ? ` x ${market.quantity.toLocaleString('en-US')}` : ''} | target ${formatMoney(watch.maxPrice)}${sellText ? ` | shop sell ${sellText}` : ''} | <a href="${href}">Open Item Market</a>`
        });
      }
      const bestBySeller = new Map();
      for (const listing of Array.isArray(result.bazaar?.listings) ? result.bazaar.listings : []) {
        const previous = bestBySeller.get(listing.sellerId);
        if (!previous || listing.price < previous.price) bestBySeller.set(listing.sellerId, listing);
      }
      if (watch.bazaarEnabled) for (const listing of [...bestBySeller.values()].filter(row => row.price <= watch.maxPrice).slice(0, 5)) {
        rows.push({
          id:`bazaar:${watch.uid}:${listing.sellerId}`, watchUid:watch.uid, source:'Bazaar', itemId:watch.itemId, itemName:name,
          sellerId:listing.sellerId, sellerName:listing.sellerName, price:listing.price, quantity:listing.quantity,
          maxPrice:watch.maxPrice, shopSellPrice:Number(item.shopSellPrice) || 0, shopSellName:item.shopSellName || '', href:listing.href,
          detail:`${formatMoney(listing.price)}${listing.quantity > 0 ? ` × ${listing.quantity.toLocaleString('en-US')}` : ''} from ${listing.sellerName} · target ${formatMoney(watch.maxPrice)}${sellText ? ` · shop sells ${sellText}` : ''}`,
          shareText:`Bazaar | ${name} | ${formatMoney(listing.price)}${listing.quantity > 0 ? ` x ${listing.quantity.toLocaleString('en-US')}` : ''} | ${listing.sellerName} | target ${formatMoney(watch.maxPrice)}${sellText ? ` | shop sell ${sellText}` : ''} | <a href="${listing.href}">Open Bazaar</a>`
        });
      }
      return rows;
    }).sort((left, right) => left.price - right.price);
  }

  SLINK.define('core', 'market', Object.freeze({
    ITEM_MARKET_CACHE_SAFETY_MS, ITEM_MARKET_FALLBACK_MS, POINTS_MARKET_REFRESH_MS, PRIORITIES,
    TORN_PRIORITY_LIMITS, WEAVER_FALLBACK_BACKOFF_MS, WEAVER_MIN_REQUEST_SPACING_MS, WEAVER_RATE_LIMIT,
    WEAVER_RATE_WINDOW_MS, WEAVER_REFRESH_MS, bazaarUrl, catalogItems, defaultSettings, effectivePriority,
    itemMarketCache, itemMarketListings, itemMarketNextCheckAt, itemMarketUrl, normalizePriority, normalizeSettings,
    normalizeWatch, opportunityRows, pointsMarketListings, pointsMarketUrl, shopSellDetails, staleRetryMs, weaverListings
  }));
})(globalThis);
