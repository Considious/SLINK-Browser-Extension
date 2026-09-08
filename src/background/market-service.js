(function installMarketService(global) {
  'use strict';

  const SLINK = global.SLINK_EXTENSION;
  const MARKET = SLINK.core.market;
  const ALARM = 'slink.market.watch';
  const KEYS = Object.freeze({ settings:'market.settings.v1', runtime:'market.runtime.v1' });
  const CATALOG_MAX_AGE_MS = 24 * 60 * 60_000;
  let refreshing = null;

  async function settings() { return MARKET.normalizeSettings(await SLINK.core.storage.get(KEYS.settings, {})); }
  async function runtime() {
    const stored = await SLINK.core.storage.get(KEYS.runtime, {});
    return {
      catalog:stored?.catalog && typeof stored.catalog === 'object' ? stored.catalog : { fetchedAt:0, items:[] },
      results:stored?.results && typeof stored.results === 'object' ? stored.results : {},
      weaver:stored?.weaver && typeof stored.weaver === 'object' ? stored.weaver : { events:[], cooldownUntil:0 },
      fetchedAt:Number(stored?.fetchedAt) || 0,
      lastError:String(stored?.lastError || '')
    };
  }
  async function saveRuntime(value) { await SLINK.core.storage.set(KEYS.runtime, value); return value; }

  async function accessState({ authenticate = false } = {}) {
    const session = authenticate ? await SLINK.services.permissionAccess.ensureSession(false, '') : await SLINK.core.storage.get('access.session.v1', null);
    const active = session?.token && Number(session?.expiresAt) > Date.now();
    const permissions = active ? session : await SLINK.core.storage.get('permissions.snapshot', {});
    const limit = SLINK.core.adhd.marketWatchLimit(permissions || {});
    return { limit, permitted:limit > 0 };
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

  function pruneWeaver(value, now = Date.now()) {
    return {
      events:(Array.isArray(value?.events) ? value.events : []).map(Number).filter(at => at > now - MARKET.WEAVER_RATE_WINDOW_MS && at <= now + 5_000).sort((a, b) => a - b),
      cooldownUntil:Number(value?.cooldownUntil) > now ? Number(value.cooldownUntil) : 0
    };
  }

  async function weaverJson(url, current) {
    const now = Date.now();
    current.weaver = pruneWeaver(current.weaver, now);
    const spacingAt = Number(current.weaver.events.at(-1) || 0) + MARKET.WEAVER_MIN_REQUEST_SPACING_MS;
    const windowAt = Number(current.weaver.events[0] || 0) + MARKET.WEAVER_RATE_WINDOW_MS;
    const retryAt = Math.max(current.weaver.cooldownUntil, spacingAt, current.weaver.events.length >= MARKET.WEAVER_RATE_LIMIT ? windowAt : 0);
    if (retryAt > now) {
      const error = new Error('Weaver request budget is reserved for a later watch.'); error.code = 'SLINK_WEAVER_RATE_LIMIT'; error.retryAfterMs = retryAt - now; throw error;
    }
    current.weaver.events.push(now);
    try { return await SLINK.core.http.requestJson('weaver', url, { cache:'no-store' }); }
    catch (error) {
      if (Number(error?.status) === 429) current.weaver.cooldownUntil = Date.now() + (Number(error?.retryAfterMs) || MARKET.WEAVER_FALLBACK_BACKOFF_MS);
      throw error;
    }
  }

  async function ensureCatalog({ force = false, key = '', current = null } = {}) {
    const state = current || await runtime();
    if (!force && state.catalog?.items?.length && Date.now() - Number(state.catalog.fetchedAt) < CATALOG_MAX_AGE_MS) return state.catalog;
    if (!(await accessState({ authenticate:true })).permitted) throw new Error('A signed SLINK Market Watch permission is required.');
    const body = await tornJson('https://api.torn.com/v2/torn/items?cat=All&sort=ASC', key || await tornKey(), '/v2/torn/items', 'high');
    const items = MARKET.catalogItems(body);
    if (!items.length) throw new Error('Torn returned an empty item catalog.');
    state.catalog = { fetchedAt:Date.now(), items }; await saveRuntime(state); return state.catalog;
  }

  function due(source, force = false) { return force || !Number(source?.nextCheckAt) || Number(source.nextCheckAt) <= Date.now(); }
  function priorityFor(watch, result) { return MARKET.effectivePriority(watch, result?.market || result?.bazaar || {}); }

  async function pollItem(watch, previous, next, key, force) {
    if (!watch.marketEnabled) { delete next.market; delete next.errors.market; return; }
    if (!due(previous?.market, force)) return;
    try {
      const body = await tornJson(`https://api.torn.com/v2/market/${encodeURIComponent(watch.itemId)}/itemmarket?limit=5`, key, `/v2/market/${watch.itemId}/itemmarket`, priorityFor(watch, previous));
      const now = Date.now(); const cache = MARKET.itemMarketCache(body);
      const stale = cache.cacheTimestamp > 0 && cache.cacheTimestamp === Number(previous?.market?.cacheTimestamp);
      const cacheRetryCount = stale ? Number(previous?.market?.cacheRetryCount || 0) + 1 : 0;
      next.market = { fetchedAt:now, listings:MARKET.itemMarketListings(body), ...cache, cacheRetryCount,
        nextCheckAt:stale ? now + MARKET.staleRetryMs({ cacheRetryCount }) : MARKET.itemMarketNextCheckAt({ fetchedAt:now, ...cache }) };
      delete next.errors.market;
    } catch (error) {
      next.errors.market = SLINK.core.format.errorMessage(error);
      next.market = { ...(previous?.market || {}), nextCheckAt:Date.now() + (Number(error?.retryAfterMs) || 5_000) };
    }
  }

  async function pollPoints(watch, previous, next, key, force) {
    if (!due(previous?.points, force)) return;
    try {
      const body = await tornJson('https://api.torn.com/v2/market?selections=pointsmarket&limit=100', key, '/v2/market?selections=pointsmarket', 'high');
      const now = Date.now(); next.points = { fetchedAt:now, nextCheckAt:now + MARKET.POINTS_MARKET_REFRESH_MS, listings:MARKET.pointsMarketListings(body) };
      delete next.errors.points;
    } catch (error) {
      next.errors.points = SLINK.core.format.errorMessage(error);
      next.points = { ...(previous?.points || {}), nextCheckAt:Date.now() + (Number(error?.retryAfterMs) || 5_000) };
    }
  }

  async function pollWeaver(watch, previous, next, current, force) {
    if (!watch.bazaarEnabled) { delete next.bazaar; delete next.errors.bazaar; return; }
    const priority = priorityFor(watch, previous);
    if (!force && (Number(previous?.bazaar?.nextCheckAt) || Number(previous?.bazaar?.fetchedAt || 0) + MARKET.WEAVER_REFRESH_MS[priority]) > Date.now()) return;
    const url = `https://weav3r.dev/api/marketplace/${encodeURIComponent(watch.itemId)}?maxPrice=${encodeURIComponent(watch.maxPrice)}&limit=5`;
    try {
      const body = await weaverJson(url, current); const now = Date.now();
      next.bazaar = { fetchedAt:now, nextCheckAt:now + MARKET.WEAVER_REFRESH_MS[priority], sourceUrl:url, listings:MARKET.weaverListings(body, watch.itemId) };
      delete next.errors.bazaar;
    } catch (error) {
      next.errors.bazaar = SLINK.core.format.errorMessage(error);
      next.bazaar = { ...(previous?.bazaar || {}), nextCheckAt:Date.now() + (Number(error?.retryAfterMs) || 5_000) };
    }
  }

  function nextAt(currentSettings, current, limit) {
    const times = currentSettings.watches.slice(0, limit).filter(watch => watch.enabled).flatMap(watch => {
      const result = current.results[watch.uid] || {};
      return watch.marketType === 'points'
        ? [Number(result.points?.nextCheckAt) || Date.now()]
        : [watch.marketEnabled ? Number(result.market?.nextCheckAt) || Date.now() : 0, watch.bazaarEnabled ? Number(result.bazaar?.nextCheckAt) || Date.now() : 0].filter(Boolean);
    });
    return times.length ? Math.min(...times) : 0;
  }

  async function scheduleAlarm(when = 0) { await chrome.alarms.create(ALARM, { when:Math.max(Date.now() + 1_000, Number(when) || Date.now() + 60_000) }); }

  async function buildStatus(currentSettings, current, access) {
    const usage = await SLINK.core.tornApiLimiter.getUsage(); const allowed = currentSettings.watches.slice(0, access.limit || 0);
    const nextRefreshAt = nextAt(currentSettings, current, access.limit || 0); await scheduleAlarm(nextRefreshAt);
    return { configured:Boolean((await SLINK.services.permissionAccess.settings()).enabled), permitted:access.permitted, marketWatchLimit:access.limit,
      settings:currentSettings, catalog:current.catalog, results:current.results,
      opportunities:MARKET.opportunityRows({ ...current, catalog:current.catalog }, { ...currentSettings, watches:allowed }),
      fetchedAt:current.fetchedAt, nextRefreshAt, lastError:current.lastError, tornApiUsage:usage };
  }

  async function refresh(force = false) {
    if (refreshing) return refreshing;
    refreshing = (async () => {
      const currentSettings = await settings(); const access = await accessState({ authenticate:true }); const current = await runtime();
      if (!access.permitted) throw new Error('Your account does not have a SLINK Market Watch tier.');
      if (!currentSettings.enabled) return buildStatus(currentSettings, current, access);
      const key = await tornKey();
      try {
        if (currentSettings.watches.some(watch => watch.marketType === 'item')) current.catalog = await ensureCatalog({ key, current });
        const allowed = currentSettings.watches.slice(0, access.limit); const valid = new Set(allowed.map(watch => watch.uid));
        current.results = Object.fromEntries(Object.entries(current.results).filter(([uid]) => valid.has(uid)));
        const ordered = [...allowed].sort((a, b) => MARKET.PRIORITIES[priorityFor(a, current.results[a.uid])] - MARKET.PRIORITIES[priorityFor(b, current.results[b.uid])]);
        for (const watch of ordered) {
          if (!watch.enabled || !(watch.maxPrice > 0)) continue;
          const previous = current.results[watch.uid] || {}; const next = { ...previous, errors:{ ...(previous.errors || {}) } };
          if (watch.marketType === 'points') {
            delete next.market; delete next.bazaar; delete next.errors.market; delete next.errors.bazaar; await pollPoints(watch, previous, next, key, force);
          } else if (watch.itemId > 0) {
            delete next.points; delete next.errors.points; await pollItem(watch, previous, next, key, force); await pollWeaver(watch, previous, next, current, force);
          }
          current.results[watch.uid] = next;
        }
        current.fetchedAt = Date.now();
        current.lastError = allowed.flatMap(watch => Object.entries(current.results[watch.uid]?.errors || {}).map(([source, message]) => `${watch.label} ${source}: ${message}`)).join(' · ');
      } catch (error) { current.lastError = SLINK.core.format.errorMessage(error); }
      await saveRuntime(current); return buildStatus(currentSettings, current, access);
    })();
    try { return await refreshing; } finally { refreshing = null; }
  }

  async function publicStatus(refreshIfDue = false) {
    const currentSettings = await settings(); const access = await accessState(); let current = await runtime();
    const configured = Boolean((await SLINK.services.permissionAccess.settings()).enabled);
    if (refreshIfDue && configured && access.permitted && currentSettings.enabled) {
      if (!current.catalog?.items?.length || Date.now() - Number(current.catalog?.fetchedAt) >= CATALOG_MAX_AGE_MS) {
        try { current.catalog = await ensureCatalog({ current }); } catch (error) { current.lastError = SLINK.core.format.errorMessage(error); await saveRuntime(current); }
      }
      if (nextAt(currentSettings, current, access.limit) <= Date.now()) return refresh(false);
    }
    return buildStatus(currentSettings, current, access);
  }

  async function saveSettings(input = {}) {
    const previous = await settings(); const next = MARKET.normalizeSettings({ ...previous, ...input, watches:previous.watches });
    await SLINK.core.storage.set(KEYS.settings, next); return publicStatus(false);
  }

  async function upsertWatch(input = {}) {
    const access = await accessState({ authenticate:true }); if (!access.permitted) throw new Error('A signed SLINK Market Watch permission is required.');
    const previous = await settings(); const watch = MARKET.normalizeWatch(input, previous.watches.length);
    if (!(watch.maxPrice > 0)) throw new Error('Enter a maximum price.');
    if (watch.marketType === 'item') {
      if (!(watch.itemId > 0)) throw new Error('Choose a Torn item.');
      const catalog = await ensureCatalog(); const item = catalog.items.find(row => Number(row.id) === watch.itemId);
      if (!item) throw new Error('That item is not in the current Torn item catalog.'); watch.label = item.name;
    }
    const index = previous.watches.findIndex(row => row.uid === watch.uid);
    const duplicate = previous.watches.findIndex(row => row.marketType === watch.marketType && (watch.marketType === 'points' || row.itemId === watch.itemId) && row.uid !== watch.uid);
    if (duplicate >= 0) throw new Error(`${watch.label} is already watched.`);
    if (index >= 0) previous.watches[index] = watch;
    else { if (previous.watches.length >= access.limit) throw new Error(`Your permission allows ${access.limit} Market Watch items.`); previous.watches.push(watch); }
    previous.lastPriority = watch.priority;
    await SLINK.core.storage.set(KEYS.settings, MARKET.normalizeSettings(previous));
    const current = await runtime(); delete current.results[watch.uid]; await saveRuntime(current); return refresh(false);
  }

  async function removeWatch(payload = {}) {
    const previous = await settings(); const uid = String(payload?.uid || ''); previous.watches = previous.watches.filter(watch => watch.uid !== uid);
    await SLINK.core.storage.set(KEYS.settings, MARKET.normalizeSettings(previous)); const current = await runtime(); delete current.results[uid]; await saveRuntime(current);
    return publicStatus(false);
  }

  async function ensureAlarm() { if (!await chrome.alarms.get(ALARM)) await scheduleAlarm(Date.now() + 1_000); return chrome.alarms.get(ALARM); }
  const routes = Object.freeze({
    'market.status':payload => publicStatus(payload?.refreshIfDue !== false), 'market.refresh':() => refresh(true), 'market.settings.save':saveSettings,
    'market.catalog':async payload => { await ensureCatalog({ force:payload?.force === true }); return publicStatus(false); },
    'market.watch.save':upsertWatch, 'market.watch.remove':removeWatch
  });
  SLINK.define('services', 'market', Object.freeze({ ALARM, ensureAlarm, publicStatus, refresh, routes }));
})(globalThis);
