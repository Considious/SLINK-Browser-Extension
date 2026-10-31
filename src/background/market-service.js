(function installMarketService(global) {
  'use strict';

  const SLINK = global.SLINK_EXTENSION;
  const MARKET = SLINK.core.market;
  const ALARM = 'slink.market.watch';
  const DOLLAR_ALARM = 'slink.market.dollar-bazaars';
  const DOLLAR_REFRESH_MS = 60 * 60_000;
  const INACTIVE_AFTER_MS = 5 * 60_000;
  const KEYS = Object.freeze({ settings:'market.settings.v1', runtime:'market.runtime.v1', activity:'market.activity.v1', dollarBazaars:'market.dollar-bazaars.v1', dismissals:'market.dismissals.v1', soundState:'market.sound.state.v1' });
  const CATALOG_MAX_AGE_MS = 24 * 60 * 60_000;
  let refreshing = null;
  let dollarRefreshing = null;
  let settingsQueue = Promise.resolve();
  function mutateSettings(prepare,update){
    const prepared=Promise.resolve().then(prepare);void prepared.catch(()=>{});
    const operation=settingsQueue.catch(()=>{}).then(()=>prepared).then(async context=>{
      const raw=await SLINK.core.storage.get(KEYS.settings,{}),previous=MARKET.normalizeSettings(raw);
      const changed=update(previous,context);
      if(!changed)return {settings:previous,context};
      const normalized=MARKET.normalizeSettings(changed);
      normalized.watches=normalized.watches.map(watch=>({...((Array.isArray(raw.watches)?raw.watches:[]).find(row=>row?.uid===watch.uid)||{}),...watch}));
      const next={...raw,...normalized};await SLINK.core.storage.set(KEYS.settings,next);
      return {settings:MARKET.normalizeSettings(next),context};
    });settingsQueue=operation;return operation;
  }

  async function settings() { return MARKET.normalizeSettings(await SLINK.core.storage.get(KEYS.settings, {})); }

  async function activityStatus(now = Date.now()) {
    const activity = await SLINK.core.storage.get(KEYS.activity, {});
    const lastActiveAt = Math.max(0, Number(activity?.lastActiveAt) || 0);
    return {
      lastActiveAt,
      active:lastActiveAt > 0 && now - lastActiveAt <= INACTIVE_AFTER_MS,
      inactiveAfterMs:INACTIVE_AFTER_MS
    };
  }

  async function touchActivity() {
    const activity = { lastActiveAt:Date.now() };
    await SLINK.core.storage.set(KEYS.activity, activity);
    await scheduleAlarm(Date.now() + 1_000);
    return activityStatus(activity.lastActiveAt);
  }
  async function runtime() {
    const stored = await SLINK.core.storage.get(KEYS.runtime, {});
    return {
      catalog:stored?.catalog && typeof stored.catalog === 'object' ? stored.catalog : { fetchedAt:0, items:[] },
      results:stored?.results && typeof stored.results === 'object' ? stored.results : {},
      pricelistResults:stored?.pricelistResults && typeof stored.pricelistResults === 'object' ? stored.pricelistResults : {},
      weaverSummary:stored?.weaverSummary && typeof stored.weaverSummary === 'object' ? stored.weaverSummary : { fetchedAt:0, items:[] },
      weaverPricelist:stored?.weaverPricelist && typeof stored.weaverPricelist === 'object' ? stored.weaverPricelist : { userId:null, fetchedAt:0, nextCheckAt:0, items:[], lastError:'' },
      weaver:stored?.weaver && typeof stored.weaver === 'object' ? stored.weaver : { events:[], cooldownUntil:0 },
      fetchedAt:Number(stored?.fetchedAt) || 0,
      lastError:String(stored?.lastError || '')
    };
  }
  async function saveRuntime(value) { await SLINK.core.storage.set(KEYS.runtime, value); return value; }

  function dealDismissKey(deal = {}) {
    return `${String(deal.id || '')}|${Math.max(0, Number(deal.price) || 0)}|${Math.max(0, Number(deal.quantity) || 0)}`;
  }

  async function activeDismissals(now = Date.now()) {
    const stored = await SLINK.core.storage.get(KEYS.dismissals, {});
    const active = Object.fromEntries(Object.entries(stored && typeof stored === 'object' ? stored : {})
      .filter(([key, until]) => key && Number(until) > now));
    if (Object.keys(active).length !== Object.keys(stored && typeof stored === 'object' ? stored : {}).length) {
      await SLINK.core.storage.set(KEYS.dismissals, active);
    }
    return active;
  }

  async function accessState({ authenticate = false, force = false } = {}) {
    const session = authenticate ? await SLINK.services.permissionAccess.ensureSession(force, '') : await SLINK.core.storage.get('access.session.v1', null);
    const active = session?.token && Number(session?.expiresAt) > Date.now();
    const permissions = active ? session : await SLINK.core.storage.get('permissions.snapshot', {});
    const limit = SLINK.core.adhd.marketWatchLimit(permissions || {});
    return { limit, permitted:limit > 0, userId:Number(permissions?.userId || session?.userId) || null };
  }

  function assertActiveSlotLimit(settingsValue, access) {
    const count = MARKET.activeSlotCount(settingsValue);
    if (count > Number(access.limit || 0)) throw new Error(`Your permission allows ${access.limit || 0} active Market Watch item${Number(access.limit) === 1 ? '' : 's'}. Disable another saved or Weaver watch first.`);
    return count;
  }

  async function tornKey() {
    const [access, leveling, war] = await Promise.all([
      SLINK.services.permissionAccess.settings(), SLINK.core.storage.get('leveling.settings.v1', {}), SLINK.core.storage.get('war.settings.v1', {})
    ]);
    const key = String(access?.tornKey || leveling?.tornKey || war?.tornKey || '').trim();
    if (!key) throw new Error('Save your Torn API key before using Market Watch.');
    return key;
  }

  async function tornJson(url, key, endpoint, priority = 'normal') {
    const normalized = MARKET.normalizePriority(priority);
    await SLINK.core.tornApiLimiter.reserve({ wait:false, limit:MARKET.TORN_PRIORITY_LIMITS[normalized], script:'SLINK Market Watch', priority:normalized, endpoint });
    return SLINK.core.http.requestJson('tornApi', url, { headers:{ Authorization:`ApiKey ${key}` }, cache:'no-store' });
  }

  const WEAVER_MINUTE_LIMIT_MESSAGE = 'Weaver per-minute request budget is capped. Remaining items are queued for the next cycle.';
  const WEAVER_DAILY_LIMIT_MESSAGE = 'Weaver daily request limit has been reached. Bazaar watches will resume when Weaver resets the daily allowance. Consider disabling lower-priority Bazaar watches.';

  function weaverLimitKind(error) {
    const detail = [
      error?.message,
      error?.data?.error?.message,
      error?.data?.error,
      error?.data?.message,
      error?.data?.detail,
      error?.data?.code
    ].filter(value => typeof value === 'string').join(' ').toLowerCase();
    return /\b(daily|per[ -]?day|day[ -]?(?:limit|quota)|daily[ -]?(?:limit|quota))\b/.test(detail) ? 'daily' : /per[ -]?minute|minute[ -]?(?:limit|quota)/.test(detail) ? 'minute' : 'unknown';
  }

  function weaverLimitError(kind, retryAfterMs = 0) {
    const daily = kind === 'daily';
    const error = new Error(daily ? WEAVER_DAILY_LIMIT_MESSAGE : kind==='minute' ? WEAVER_MINUTE_LIMIT_MESSAGE : 'Weaver request allowance was reached; the service did not identify whether it is per-minute or daily. Checks will retry after the current backoff.');
    error.code = daily ? 'SLINK_WEAVER_DAILY_LIMIT' : kind==='minute' ? 'SLINK_WEAVER_RATE_LIMIT' : 'SLINK_WEAVER_LIMIT_UNKNOWN';
    error.retryAfterMs = Math.max(0, Number(retryAfterMs) || 0);
    error.limitKind = kind;
    return error;
  }

  function pruneWeaver(value, now = Date.now()) {
    const cooldownUntil = Number(value?.cooldownUntil) > now ? Number(value.cooldownUntil) : 0;
    return {
      events:(Array.isArray(value?.events) ? value.events : []).map(Number).filter(at => at > now - MARKET.WEAVER_RATE_WINDOW_MS && at <= now + 5_000).sort((a, b) => a - b),
      cooldownUntil,
      cooldownReason:cooldownUntil && ['daily','minute','unknown'].includes(value?.cooldownReason) ? value.cooldownReason : 'minute'
    };
  }

  async function weaverJson(url, current) {
    let now = Date.now();
    current.weaver = pruneWeaver(current.weaver, now);
    const spacingAt = Number(current.weaver.events.at(-1) || 0) + MARKET.WEAVER_MIN_REQUEST_SPACING_MS;
    const windowAt = Number(current.weaver.events[0] || 0) + MARKET.WEAVER_RATE_WINDOW_MS;
    const retryAt = Math.max(current.weaver.cooldownUntil, spacingAt, current.weaver.events.length >= MARKET.WEAVER_RATE_LIMIT ? windowAt : 0);
    if (retryAt > now && retryAt - now <= MARKET.WEAVER_MIN_REQUEST_SPACING_MS + 100) {
      await new Promise(resolve => setTimeout(resolve, retryAt - now)); now = Date.now(); current.weaver = pruneWeaver(current.weaver, now);
    } else if (retryAt > now) {
      const kind = current.weaver.cooldownUntil === retryAt ? current.weaver.cooldownReason : 'minute';
      throw weaverLimitError(kind, retryAt - now);
    }
    current.weaver.events.push(now);
    try { return await SLINK.core.http.requestJson('weaver', url, { cache:'no-store' }); }
    catch (error) {
      if (Number(error?.status) === 429) {
        const kind = weaverLimitKind(error);
        const retryAfterMs = Number(error?.retryAfterMs) || MARKET.WEAVER_FALLBACK_BACKOFF_MS;
        current.weaver.cooldownUntil = Date.now() + retryAfterMs;
        current.weaver.cooldownReason = kind;
        throw weaverLimitError(kind, retryAfterMs);
      }
      throw error;
    }
  }

  async function ensureCatalog({ force = false, key = '', current = null } = {}) {
    const state = current || await runtime();
    if (!(await accessState({ authenticate:true })).permitted) throw new Error('A signed SLINK Market Watch permission is required.');
    const catalog = await SLINK.services.sharedData.catalog({ key:key || await tornKey(), force, maxAgeMs:CATALOG_MAX_AGE_MS, needPrices:true });
    if (state.catalog?.metadataAt !== catalog.metadataAt || state.catalog?.pricesAt !== catalog.pricesAt) {
      state.catalog = catalog;
      await saveRuntime(state);
    }
    return catalog;
  }

  function due(source, force = false) { return force || !Number(source?.nextCheckAt) || Number(source.nextCheckAt) <= Date.now(); }
  function priorityFor(watch, result) { return MARKET.effectivePriority(watch, result?.market || result?.bazaar || {}); }

  async function pollItem(watch, previous, next, key, force) {
    if (!watch.marketEnabled) { delete next.market; delete next.errors.market; return null; }
    if (!due(previous?.market, force)) return null;
    try {
      const body = await tornJson(`https://api.torn.com/v2/market/${encodeURIComponent(watch.itemId)}/itemmarket?limit=5`, key, `/v2/market/${watch.itemId}/itemmarket`, priorityFor(watch, previous));
      const now = Date.now(); const cache = MARKET.itemMarketCache(body);
      const stale = cache.cacheTimestamp > 0 && cache.cacheTimestamp === Number(previous?.market?.cacheTimestamp);
      const cacheRetryCount = stale ? Number(previous?.market?.cacheRetryCount || 0) + 1 : 0;
      next.market = { fetchedAt:now, listings:MARKET.itemMarketListings(body), ...cache, cacheRetryCount,
        nextCheckAt:stale ? now + MARKET.staleRetryMs({ cacheRetryCount }) : MARKET.itemMarketNextCheckAt({ fetchedAt:now, ...cache }) };
      delete next.errors.market;
      return null;
    } catch (error) {
      next.errors.market = SLINK.core.format.errorMessage(error);
      next.market = { ...(previous?.market || {}), nextCheckAt:Date.now() + (Number(error?.retryAfterMs) || 5_000) };
      return error?.code === 'SLINK_TORN_API_LIMIT' ? { blockedUntil:next.market.nextCheckAt } : null;
    }
  }

  async function pollPoints(watch, previous, next, key, force) {
    if (!due(previous?.points, force)) return null;
    try {
      const body = await tornJson('https://api.torn.com/v2/market?selections=pointsmarket&limit=100', key, '/v2/market?selections=pointsmarket', 'high');
      const now = Date.now(); next.points = { fetchedAt:now, nextCheckAt:now + MARKET.POINTS_MARKET_REFRESH_MS, listings:MARKET.pointsMarketListings(body) };
      delete next.errors.points;
      return null;
    } catch (error) {
      next.errors.points = SLINK.core.format.errorMessage(error);
      next.points = { ...(previous?.points || {}), nextCheckAt:Date.now() + (Number(error?.retryAfterMs) || 5_000) };
      return error?.code === 'SLINK_TORN_API_LIMIT' ? { blockedUntil:next.points.nextCheckAt } : null;
    }
  }

  async function syncWeaverPricelist(current, access, force = false) {
    const previous = current.weaverPricelist || {};
    if (!force && Number(previous.nextCheckAt) > Date.now() && Number(previous.userId) === Number(access.userId)) return previous;
    if (!(Number(access.userId) > 0)) throw new Error('Refresh SLINK permissions so Weaver can identify your Torn account.');
    const url = `https://weav3r.dev/api/pricelist/${encodeURIComponent(access.userId)}`;
    try {
      const body = await weaverJson(url, current); const now = Date.now();
      current.weaverPricelist = { userId:access.userId, fetchedAt:now, nextCheckAt:now + MARKET.WEAVER_PRICELIST_REFRESH_MS, items:MARKET.weaverPricelistItems(body), lastError:'' };
    } catch (error) {
      current.weaverPricelist = { ...previous, userId:access.userId, nextCheckAt:Date.now() + (Number(error?.retryAfterMs) || 15_000), lastError:SLINK.core.format.errorMessage(error) };
    }
    return current.weaverPricelist;
  }

  async function pruneWeaverSelection(settingsValue, current) {
    const result=await mutateSettings(async()=>{const latest=await runtime();return Number(latest.weaverPricelist?.fetchedAt)>Number(current.weaverPricelist?.fetchedAt)?latest:current;},(previous,source)=>{
      const available=new Set(MARKET.weaverPricelistItems(source.weaverPricelist?.items||[]).map(item=>item.itemId));
      const selected=previous.weaverActiveItemIds.filter(itemId=>available.has(itemId));
      return selected.length===previous.weaverActiveItemIds.length?null:{...previous,weaverActiveItemIds:selected};
    });return result.settings;
  }

  async function ensureWeaverSummary(current, force = false, maxAgeMs = MARKET.WEAVER_SUMMARY_REFRESH_MS) {
    if (!force && current.weaverSummary?.items?.length && Date.now() - Number(current.weaverSummary.fetchedAt) < maxAgeMs) return current.weaverSummary;
    const body = await weaverJson('https://weav3r.dev/api/marketplace', current); const now = Date.now();
    current.weaverSummary = { fetchedAt:now, items:MARKET.weaverMarketplaceItems(body) };
    return current.weaverSummary;
  }

  function weaverTargets(currentSettings, allowed, current) {
    const targets = new Map();
    const add = (itemId, threshold, source, priority) => {
      if (!(itemId > 0) || !(threshold > 0)) return;
      const previous = targets.get(itemId) || { itemId, threshold:0, priority, manual:[], pricelist:false };
      previous.threshold = Math.max(previous.threshold, threshold);
      if (MARKET.PRIORITIES[priority] < MARKET.PRIORITIES[previous.priority]) previous.priority = priority;
      if (source === 'pricelist') previous.pricelist = true; else previous.manual.push(source);
      targets.set(itemId, previous);
    };
    if (currentSettings.listedItemsEnabled) for (const watch of allowed) if (watch.enabled && watch.marketType === 'item' && watch.bazaarEnabled) {
      add(watch.itemId, watch.maxPrice, watch, priorityFor(watch, current.results[watch.uid]));
    }
    const activePricelistIds = new Set(currentSettings.weaverActiveItemIds);
    if (currentSettings.weaverPricelistEnabled) for (const item of MARKET.weaverPricelistItems(current.weaverPricelist?.items || []).filter(row => activePricelistIds.has(row.itemId))) {
      add(item.itemId, Math.max(item.buyPrice, item.bulkBuyPrice || 0), 'pricelist', 'normal');
    }
    const first = currentSettings.weaverSourceOrder === 'pricelist-first' ? 'pricelist' : 'manual';
    return [...targets.values()].sort((a, b) => {
      const aRank = first === 'pricelist' ? (a.pricelist ? 0 : 1) : (a.manual.length ? 0 : 1);
      const bRank = first === 'pricelist' ? (b.pricelist ? 0 : 1) : (b.manual.length ? 0 : 1);
      return aRank - bRank || MARKET.PRIORITIES[a.priority] - MARKET.PRIORITIES[b.priority] || a.itemId - b.itemId;
    });
  }

  function storeWeaverResult(target, allowed, current, payload) {
    for (const watch of target.manual) {
      const result = current.results[watch.uid] || { errors:{} }; result.errors ||= {};
      result.bazaar = payload; delete result.errors.bazaar; current.results[watch.uid] = result;
    }
    if (target.pricelist) current.pricelistResults[target.itemId] = { bazaar:payload, errors:{} };
  }

  async function pollWeaverTargets(currentSettings, allowed, current, force) {
    const targets = weaverTargets(currentSettings, allowed, current).filter(target => force
      || target.manual.some(watch => due(current.results[watch.uid]?.bazaar))
      || (target.pricelist && due(current.pricelistResults?.[target.itemId]?.bazaar)));
    if (!targets.length) return;
    let summary;
    try { summary = await ensureWeaverSummary(current, force, MARKET.WEAVER_SUMMARY_REFRESH_MS); }
    catch (error) {
      const retryAt = Date.now() + (Number(error?.retryAfterMs) || 5_000);
      for (const target of targets) storeWeaverResult(target, allowed, current, { nextCheckAt:retryAt, listings:[] });
      throw error;
    }
    const lowest = new Map(summary.items.map(item => [item.itemId, item.lowestPrice]));
    for (const target of targets) {
      const now = Date.now();
      const nextCheckAt = Math.max(now + 1_000, Number(summary.fetchedAt) + MARKET.WEAVER_SUMMARY_REFRESH_MS);
      const currentLowest = Number(lowest.get(target.itemId));
      if (!(currentLowest > 0) || currentLowest > target.threshold) {
        storeWeaverResult(target, allowed, current, {
          fetchedAt:now, nextCheckAt, screenedAt:summary.fetchedAt,
          lowestPrice:currentLowest || 0, listings:[]
        });
        continue;
      }
      const url = `https://weav3r.dev/api/marketplace/${encodeURIComponent(target.itemId)}?maxPrice=${encodeURIComponent(target.threshold)}&limit=5`;
      try {
        const body = await weaverJson(url, current);
        storeWeaverResult(target, allowed, current, {
          fetchedAt:Date.now(), nextCheckAt, screenedAt:summary.fetchedAt,
          lowestPrice:currentLowest, sourceUrl:url,
          listings:MARKET.weaverListings(body, target.itemId)
        });
      } catch (error) {
        const retry = Date.now() + (Number(error?.retryAfterMs) || 5_000);
        storeWeaverResult(target, allowed, current, {
          fetchedAt:now, nextCheckAt:retry, screenedAt:summary.fetchedAt,
          lowestPrice:currentLowest, listings:[]
        });
        if (['SLINK_WEAVER_RATE_LIMIT','SLINK_WEAVER_DAILY_LIMIT','SLINK_WEAVER_LIMIT_UNKNOWN'].includes(error?.code)) break;
      }
    }
  }

  function nextAt(currentSettings, current, _limit) {
    const times = (currentSettings.listedItemsEnabled ? currentSettings.watches : []).filter(watch => watch.enabled).flatMap(watch => {
      const result = current.results[watch.uid] || {};
      return watch.marketType === 'points'
        ? [Number(result.points?.nextCheckAt) || Date.now()]
        : [watch.marketEnabled ? Number(result.market?.nextCheckAt) || Date.now() : 0, watch.bazaarEnabled ? Number(result.bazaar?.nextCheckAt) || Date.now() : 0].filter(Boolean);
    });
    if (currentSettings.weaverPricelistEnabled) {
      times.push(Number(current.weaverPricelist?.nextCheckAt) || Date.now());
      const activeIds = new Set(currentSettings.weaverActiveItemIds);
      for (const item of MARKET.weaverPricelistItems(current.weaverPricelist?.items || []).filter(row => activeIds.has(row.itemId))) times.push(Number(current.pricelistResults?.[item.itemId]?.bazaar?.nextCheckAt) || Date.now());
    }
    return times.length ? Math.min(...times) : 0;
  }

  function queueTornCheck(next, previous, source, blockedUntil) {
    next.errors[source] = 'Waiting for shared Torn API capacity.';
    next[source] = { ...(previous?.[source] || {}), nextCheckAt:blockedUntil };
  }

  function summarizeErrors(watches, results) {
    const groups = new Map();
    for (const watch of watches) for (const [source, message] of Object.entries(results[watch.uid]?.errors || {})) {
      const normalizedMessage = String(message || '').trim();
      if (!normalizedMessage) continue;
      const capacity = /shared Torn API (?:limit|capacity)|Waiting for shared Torn API capacity/i.test(normalizedMessage);
      const key = capacity ? 'torn-capacity' : `${source}:${normalizedMessage}`;
      const group = groups.get(key) || { source, message:normalizedMessage, capacity, watches:[] };
      group.watches.push(watch.label || (watch.marketType === 'points' ? 'Points Market' : `Item ${watch.itemId}`));
      groups.set(key, group);
    }
    return [...groups.values()].map(group => {
      if (group.capacity) return `${group.watches.length} Market Watch check${group.watches.length === 1 ? '' : 's'} queued for shared Torn API capacity.`;
      const source = group.source === 'bazaar' ? 'Weaver Bazaar' : group.source === 'points' ? 'Points Market' : 'Item Market';
      return group.watches.length > 1 ? `${source} (${group.watches.length} watches): ${group.message}` : `${group.watches[0]} ${source}: ${group.message}`;
    }).join(' · ');
  }

  async function scheduleAlarm(when = 0) { await chrome.alarms.create(ALARM, { when:Math.max(Date.now() + 1_000, Number(when) || Date.now() + 60_000) }); }

  async function buildStatus(currentSettings, current, access) {
    const usage = await SLINK.core.tornApiLimiter.getUsage(); const allowed = currentSettings.watches.filter(watch => watch.enabled);
    const activity = await activityStatus();
    const nextRefreshAt = nextAt(currentSettings, current, access.limit || 0);
    if (activity.active) await scheduleAlarm(nextRefreshAt);
    else await chrome.alarms.clear(ALARM);
    const dismissals = await activeDismissals();
    const opportunities = MARKET.opportunityRows({ ...current, catalog:current.catalog }, { ...currentSettings, watches:allowed })
      .map(row => ({ ...row, dismissKey:dealDismissKey(row) }))
      .filter(row => !dismissals[row.dismissKey]);
    return { configured:Boolean((await SLINK.services.permissionAccess.settings()).enabled), permitted:access.permitted, marketWatchLimit:access.limit,
      settings:currentSettings, catalog:current.catalog, results:current.results,
      activeWatchCount:MARKET.activeSlotCount(currentSettings), savedWatchCount:currentSettings.watches.length,
      weaverPricelist:{ userId:current.weaverPricelist?.userId || null, fetchedAt:Number(current.weaverPricelist?.fetchedAt) || 0, itemCount:MARKET.weaverPricelistItems(current.weaverPricelist?.items || []).length, items:MARKET.weaverPricelistItems(current.weaverPricelist?.items || []), lastError:String(current.weaverPricelist?.lastError || '') },
      opportunities,
      activity,
      fetchedAt:current.fetchedAt, nextRefreshAt, lastError:current.lastError, tornApiUsage:usage };
  }

  async function refresh(force = false) {
    if (refreshing) return refreshing;
    refreshing = (async () => {
      let currentSettings = await settings(); const access = await accessState({ authenticate:true }); const current = await runtime();
      if (!access.permitted) throw new Error('Your account does not have a SLINK Market Watch tier.');
      if (!currentSettings.enabled) return buildStatus(currentSettings, current, access);
      const key = await tornKey();
      try {
        if (currentSettings.watches.some(watch => watch.marketType === 'item') || currentSettings.weaverPricelistEnabled) current.catalog = await ensureCatalog({ key, current });
        assertActiveSlotLimit(currentSettings, access);
        const allowed = currentSettings.watches.filter(watch => watch.enabled); const valid = new Set(allowed.map(watch => watch.uid));
        current.results = Object.fromEntries(Object.entries(current.results).filter(([uid]) => valid.has(uid)));
        if (currentSettings.weaverPricelistEnabled) { await syncWeaverPricelist(current, access, force); currentSettings = await pruneWeaverSelection(currentSettings, current); }
        else current.pricelistResults = {};
        const activePricelistIds = new Set(currentSettings.weaverActiveItemIds.map(String));
        current.pricelistResults = Object.fromEntries(Object.entries(current.pricelistResults).filter(([itemId]) => activePricelistIds.has(String(itemId))));
        const ordered = [...(currentSettings.listedItemsEnabled ? allowed : [])].sort((a, b) => MARKET.PRIORITIES[priorityFor(a, current.results[a.uid])] - MARKET.PRIORITIES[priorityFor(b, current.results[b.uid])]);
        let tornBlockedUntil = 0;
        for (const watch of ordered) {
          if (!watch.enabled || !(watch.maxPrice > 0)) continue;
          const previous = current.results[watch.uid] || {}; const next = { ...previous, errors:{ ...(previous.errors || {}) } };
          if (watch.marketType === 'points') {
            delete next.market; delete next.bazaar; delete next.errors.market; delete next.errors.bazaar;
            if (tornBlockedUntil && due(previous?.points, force)) queueTornCheck(next, previous, 'points', tornBlockedUntil);
            else tornBlockedUntil = (await pollPoints(watch, previous, next, key, force))?.blockedUntil || tornBlockedUntil;
          } else if (watch.itemId > 0) {
            delete next.points; delete next.errors.points;
            if (tornBlockedUntil && watch.marketEnabled && due(previous?.market, force)) queueTornCheck(next, previous, 'market', tornBlockedUntil);
            else tornBlockedUntil = (await pollItem(watch, previous, next, key, force))?.blockedUntil || tornBlockedUntil;
          }
          current.results[watch.uid] = next;
        }
        await pollWeaverTargets(currentSettings, allowed, current, force);
        current.fetchedAt = Date.now();
        current.lastError = summarizeErrors(allowed, current.results);
      } catch (error) { current.lastError = SLINK.core.format.errorMessage(error); }
      await saveRuntime(current); return buildStatus(currentSettings, current, access);
    })();
    try { return await refreshing; } finally { refreshing = null; }
  }

  async function publicStatus(refreshIfDue = false) {
    const currentSettings = await settings(); const access = await accessState(); let current = await runtime();
    const configured = Boolean((await SLINK.services.permissionAccess.settings()).enabled);
    const activity = await activityStatus();
    if (refreshIfDue && activity.active && configured && access.permitted && currentSettings.enabled) {
      if (!current.catalog?.items?.length || Date.now() - Number(current.catalog?.fetchedAt) >= CATALOG_MAX_AGE_MS) {
        try { current.catalog = await ensureCatalog({ current }); } catch (error) { current.lastError = SLINK.core.format.errorMessage(error); await saveRuntime(current); }
      }
      if (nextAt(currentSettings, current, access.limit) <= Date.now()) return refresh(false);
    }
    return buildStatus(currentSettings, current, access);
  }

  async function saveSettings(input = {}) {
    const patch={...input};
    const result=await mutateSettings(async()=>{const previous=await settings();return accessState({authenticate:MARKET.activeSlotCount(MARKET.normalizeSettings({...previous,...patch,watches:previous.watches}))>0});},(previous,access)=>{
      const next=MARKET.normalizeSettings({...previous,...patch,watches:previous.watches,weaverActiveItemIds:previous.weaverActiveItemIds});assertActiveSlotLimit(next,access);return next;
    });return patch.preferenceOnly===true?{settings:result.settings}:publicStatus(false);
  }

  async function upsertWatch(input = {}) {
    const captured={...input};
    const result=await mutateSettings(async()=>{
      const access=await accessState({authenticate:true});if(!access.permitted)throw Error('A signed SLINK Market Watch permission is required.');
      const item=captured.marketType==='points'?null:(await ensureCatalog()).items.find(row=>Number(row.id)===Number(captured.itemId));
      if(captured.marketType!=='points'&&!item)throw Error('That item is not in the current Torn item catalog.');
      return {access,item};
    },(previous,context)=>{
      const watch=MARKET.normalizeWatch(captured,previous.watches.length);
      if(!(watch.maxPrice>0))throw Error('Enter a maximum price.');
      if(watch.marketType==='item'){if(!(watch.itemId>0))throw Error('Choose a Torn item.');watch.label=context.item.name;}
      const index=previous.watches.findIndex(row=>row.uid===watch.uid);
      if(captured.requireExisting&&index<0)throw Error('This watch was removed. Reopen the editor before saving.');
      if(previous.watches.some(row=>row.marketType===watch.marketType&&(watch.marketType==='points'||row.itemId===watch.itemId)&&row.uid!==watch.uid))throw Error(watch.label+' is already watched.');
      if(index>=0)previous.watches[index]=watch;
      else {if(previous.watches.length>=MARKET.SAVED_WATCH_LIMIT)throw Error('Market Watch keeps up to '+MARKET.SAVED_WATCH_LIMIT+' saved entries in this browser.');previous.watches.push(watch);}
      previous.lastPriority=watch.priority;assertActiveSlotLimit(previous,context.access);context.watch=watch;return previous;
    });
    const current=await runtime();delete current.results[result.context.watch.uid];await saveRuntime(current);
    try{await refresh(false);}catch{}
    return publicStatus(false);
  }

  async function toggleWatch(input={}){
    const uid=String(input.uid||''),enabled=input.enabled===true;
    const result=await mutateSettings(()=>accessState({authenticate:true}),(previous,access)=>{
      if(!access.permitted)throw Error('A signed SLINK Market Watch permission is required.');
      const watch=previous.watches.find(row=>row.uid===uid);if(!watch)throw Error('This watch was removed.');
      watch.enabled=enabled;assertActiveSlotLimit(previous,access);return previous;
    });return publicStatus(false);
  }

  async function removeWatch(payload = {}) {
    const uid=String(payload?.uid||'');
    await mutateSettings(()=>null,previous=>({...previous,watches:previous.watches.filter(watch=>watch.uid!==uid)}));
    const current=await runtime();delete current.results[uid];await saveRuntime(current);
    return publicStatus(false);
  }

  async function dismissDeal(payload = {}) {
    const key = String(payload?.dismissKey || '').trim();
    if (!key || key.length > 240) throw new Error('Choose a current Market Watch deal to dismiss.');
    const dismissals = await activeDismissals();
    dismissals[key] = Date.now() + 5 * 60_000;
    await SLINK.core.storage.set(KEYS.dismissals, dismissals);
    return publicStatus(false);
  }

  async function refreshPermissions() {
    await accessState({ authenticate:true, force:true });
    return publicStatus(false);
  }

  async function claimSound() {
    const [currentSettings, current, access, previous, adhdSettings] = await Promise.all([
      settings(), runtime(), accessState(), SLINK.core.storage.get(KEYS.soundState, { activeKeys:[], pendingKeys:[] }),
      SLINK.core.storage.get('adhd.settings.v1', {})
    ]);
    const allowed = currentSettings.watches.filter(watch => watch.enabled);
    const dismissals = await activeDismissals();
    const opportunities = MARKET.opportunityRows({ ...current, catalog:current.catalog }, { ...currentSettings, watches:allowed })
      .map(row => ({ ...row, dismissKey:dealDismissKey(row) }))
      .filter(row => !dismissals[row.dismissKey]);
    const activeKeys = opportunities.map(row => row.dismissKey).sort();
    const activeSet = new Set((Array.isArray(previous?.activeKeys) ? previous.activeKeys : []).filter(key => activeKeys.includes(key)));
    const pendingSet = new Set((Array.isArray(previous?.pendingKeys) ? previous.pendingKeys : []).filter(key => activeKeys.includes(key)));
    activeKeys.forEach(key => { if (!activeSet.has(key)) pendingSet.add(key); });
    const pendingKeys = [...pendingSet].sort();
    const now = Date.now();
    const play = currentSettings.soundEnabled && pendingKeys.length > 0 && now - Number(previous?.claimedAt || 0) >= 5_000;
    if (!currentSettings.soundEnabled) { activeKeys.forEach(key => activeSet.add(key)); pendingSet.clear(); }
    await SLINK.core.storage.set(KEYS.soundState, { activeKeys:[...activeSet].sort(), pendingKeys:[...pendingSet].sort(), claimedAt:play ? now : Number(previous?.claimedAt) || 0, updatedAt:now });
    const normalizedAdhd = SLINK.core.adhd.normalizeSettings(adhdSettings);
    return {
      play,
      dealKeys:pendingKeys,
      soundChoice:normalizedAdhd.soundChoice,
      customSoundDataUrl:normalizedAdhd.soundChoice === 'custom' ? normalizedAdhd.customSoundDataUrl : ''
    };
  }

  async function acknowledgeSound(input = {}) {
    const acknowledged = new Set(Array.isArray(input?.dealKeys) ? input.dealKeys.map(String) : []);
    const previous = await SLINK.core.storage.get(KEYS.soundState, { activeKeys:[], pendingKeys:[] });
    const activeKeys = [...new Set([...(Array.isArray(previous?.activeKeys) ? previous.activeKeys : []), ...acknowledged])].sort();
    const pendingKeys = (Array.isArray(previous?.pendingKeys) ? previous.pendingKeys : []).filter(key => !acknowledged.has(key));
    await SLINK.core.storage.set(KEYS.soundState, { activeKeys, pendingKeys, claimedAt:pendingKeys.length ? Number(previous?.claimedAt) || 0 : 0, updatedAt:Date.now() });
    return { ok:true };
  }

  async function syncPricelist() {
    let currentSettings = await settings(); const access = await accessState({ authenticate:true, force:true }); const current = await runtime();
    if (!access.permitted) throw new Error('A signed SLINK Market Watch permission is required.');
    const synced = await syncWeaverPricelist(current, access, true); currentSettings = await pruneWeaverSelection(currentSettings, current); await saveRuntime(current);
    if (synced.lastError) throw new Error(synced.lastError);
    return currentSettings.weaverPricelistEnabled ? refresh(false) : buildStatus(currentSettings, current, access);
  }

  async function saveWeaverSelection(input = {}) {
    const requested=Array.isArray(input.itemIds)?[...input.itemIds]:[];
    const result=await mutateSettings(async()=>({access:await accessState({authenticate:true}),current:await runtime()}),(previous,context)=>{
      if(!context.access.permitted)throw Error('A signed SLINK Market Watch permission is required.');
      const available=new Set(MARKET.weaverPricelistItems(context.current.weaverPricelist?.items||[]).map(item=>item.itemId));
      const selected=[...new Set(requested.map(value=>Math.trunc(Number(value)||0)).filter(value=>available.has(value)))];
      const candidate={...previous,weaverActiveItemIds:selected};assertActiveSlotLimit({...candidate,weaverPricelistEnabled:true},context.access);return candidate;
    });
    const current=await runtime(),active=new Set(result.settings.weaverActiveItemIds.map(String));
    current.pricelistResults=Object.fromEntries(Object.entries(current.pricelistResults).filter(([id])=>active.has(String(id))));await saveRuntime(current);
    try{if(result.settings.weaverPricelistEnabled)await refresh(false);}catch{}
    return publicStatus(false);
  }

  async function toggleWeaverSelection(input = {}) {
    const itemId=Math.trunc(Number(input.itemId)||0),checked=input.checked===true;
    if(!(itemId>0))throw Error('Choose a Weaver price-list item.');
    const result=await mutateSettings(async()=>({access:await accessState({authenticate:true}),current:await runtime()}),(previous,context)=>{
      if(!context.access.permitted)throw Error('A signed SLINK Market Watch permission is required.');
      if(!MARKET.weaverPricelistItems(context.current.weaverPricelist?.items||[]).some(item=>item.itemId===itemId))throw Error('That Weaver item is no longer in the current price list.');
      const selected=new Set(previous.weaverActiveItemIds);if(checked)selected.add(itemId);else selected.delete(itemId);
      const candidate={...previous,weaverActiveItemIds:[...selected]};assertActiveSlotLimit({...candidate,weaverPricelistEnabled:true},context.access);return candidate;
    });
    if(!checked){const current=await runtime();delete current.pricelistResults[itemId];await saveRuntime(current);}
    try{if(result.settings.weaverPricelistEnabled)await refresh(false);}catch{}
    return publicStatus(false);
  }

  async function dollarRecord() {
    const stored = await SLINK.core.storage.get(KEYS.dollarBazaars, {});
    return stored && typeof stored === 'object' ? stored : {};
  }

  function buildDollarStatus(stored = {}) {
    const bazaars = MARKET.weaverDollarBazaars({
      bazaars:Array.isArray(stored.bazaars) ? stored.bazaars : [],
      items:Array.isArray(stored.items) ? stored.items : []
    });
    return {
      bazaars,
      // Keep the old field for tabs that were open during the extension update.
      items:bazaars,
      bazaarCount:bazaars.length,
      itemCount:bazaars.reduce((total, bazaar) => total + Number(bazaar.itemCount || 0), 0),
      fetchedAt:Number(stored.fetchedAt) || 0,
      nextRefreshAt:Number(stored.nextRefreshAt) || 0,
      lastError:String(stored.lastError || ''),
      sourceUrl:'https://weav3r.dev/dollar-bazaars'
    };
  }

  async function refreshDollarBazaars(force = false) {
    if (dollarRefreshing) return dollarRefreshing;
    dollarRefreshing = (async () => {
      const previous = await dollarRecord();
      if (!force && Number(previous.nextRefreshAt) > Date.now()) return buildDollarStatus(previous);
      let next;
      try {
        const current = await runtime();
        const body = await weaverJson('https://weav3r.dev/api/dollar-bazaars/bazaars?page=1&limit=100', current);
        const now = Date.now();
        next = { fetchedAt:now, nextRefreshAt:now + DOLLAR_REFRESH_MS, bazaars:MARKET.weaverDollarBazaars(body), lastError:'' };
      } catch (error) {
        next = { ...previous, nextRefreshAt:Date.now() + DOLLAR_REFRESH_MS, lastError:SLINK.core.format.errorMessage(error) };
      }
      await SLINK.core.storage.set(KEYS.dollarBazaars, next);
      return buildDollarStatus(next);
    })();
    try { return await dollarRefreshing; } finally { dollarRefreshing = null; }
  }

  async function dollarStatus(refreshIfDue = true) {
    const current = await dollarRecord();
    if (refreshIfDue && Number(current.nextRefreshAt || 0) <= Date.now()) return refreshDollarBazaars(false);
    return buildDollarStatus(current);
  }

  async function ensureDollarAlarm() {
    if (!await chrome.alarms.get(DOLLAR_ALARM)) await chrome.alarms.create(DOLLAR_ALARM, { delayInMinutes:1, periodInMinutes:60 });
    return chrome.alarms.get(DOLLAR_ALARM);
  }

  async function ensureAlarm() {
    const activity = await activityStatus();
    if (!activity.active) { await chrome.alarms.clear(ALARM); return null; }
    if (!await chrome.alarms.get(ALARM)) await scheduleAlarm(Date.now() + 1_000);
    return chrome.alarms.get(ALARM);
  }
  async function withActivity(operation, payload) {
    const captured = payload && {...payload,...(Array.isArray(payload.itemIds) ? {itemIds:[...payload.itemIds]} : {})};
    await touchActivity();
    return operation(captured);
  }
  const routes = Object.freeze({
    'market.activity.touch':touchActivity,
    'market.status':payload => publicStatus(payload?.refreshIfDue !== false),
    'market.refresh':() => withActivity(() => refresh(true)),
    'market.settings.save':payload => withActivity(saveSettings, payload),
    'market.permissions.refresh':() => withActivity(refreshPermissions),
    'market.weaver.pricelist.sync':payload => withActivity(syncPricelist, payload),
    'market.weaver.selection.save':payload => withActivity(saveWeaverSelection, payload),
    'market.weaver.selection.toggle':payload => withActivity(toggleWeaverSelection, payload),
    'market.dollar.status':payload => dollarStatus(payload?.refreshIfDue !== false),
    'market.dollar.refresh':() => refreshDollarBazaars(true),
    'market.catalog':async payload => { await ensureCatalog({ force:payload?.force === true }); return publicStatus(false); },
    'market.watch.save':payload => withActivity(upsertWatch, payload),
    'market.watch.toggle':payload => withActivity(toggleWatch, payload),
    'market.watch.remove':payload => withActivity(removeWatch, payload),
    'market.deal.dismiss':payload => withActivity(dismissDeal, payload),
    'market.sound.claim':claimSound, 'market.sound.ack':acknowledgeSound
  });
  SLINK.define('services', 'market', Object.freeze({ ALARM, DOLLAR_ALARM, INACTIVE_AFTER_MS, activityStatus, dollarStatus, ensureAlarm, ensureDollarAlarm, publicStatus, refresh, routes, touchActivity }));
})(globalThis);
