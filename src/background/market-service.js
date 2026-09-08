(function installMarketService(global) {
  'use strict';

  const SLINK = global.SLINK_EXTENSION;
  const MARKET = SLINK.core.market;
  const ALARM = 'slink.market.watch';
  const KEYS = Object.freeze({ settings:'market.settings.v1', runtime:'market.runtime.v1' });
  const CATALOG_MAX_AGE_MS = 7 * 24 * 60 * 60_000;
  const WEAVER_MIN_SPACING_MS = 300;
  let refreshing = null;
  let lastWeaverRequestAt = 0;

  async function settings() {
    return MARKET.normalizeSettings(await SLINK.core.storage.get(KEYS.settings, {}));
  }

  async function runtime() {
    const stored = await SLINK.core.storage.get(KEYS.runtime, {});
    return {
      catalog:stored?.catalog && typeof stored.catalog === 'object' ? stored.catalog : { fetchedAt:0, items:[] },
      results:stored?.results && typeof stored.results === 'object' ? stored.results : {},
      fetchedAt:Number(stored?.fetchedAt) || 0,
      lastError:String(stored?.lastError || '')
    };
  }

  async function saveRuntime(value) {
    await SLINK.core.storage.set(KEYS.runtime, value);
    return value;
  }

  async function accessState({ authenticate = false } = {}) {
    const session = authenticate
      ? await SLINK.services.permissionAccess.ensureSession(false, '')
      : await SLINK.core.storage.get('access.session.v1', null);
    const active = session?.token && Number(session?.expiresAt) > Date.now();
    const permissions = active ? session : await SLINK.core.storage.get('permissions.snapshot', {});
    const limit = SLINK.core.adhd.marketWatchLimit(permissions || {});
    return { session:active ? session : null, permissions, limit, permitted:limit > 0 };
  }

  async function tornKey() {
    const [access, leveling, war] = await Promise.all([
      SLINK.services.permissionAccess.settings(),
      SLINK.core.storage.get('leveling.settings.v1', {}),
      SLINK.core.storage.get('war.settings.v1', {})
    ]);
    const key = String(access?.tornKey || leveling?.tornKey || war?.tornKey || '').trim();
    if (!key) throw new Error('Save your Torn API key before using Market Watch.');
    return key;
  }

  async function tornJson(url, key, endpoint) {
    await SLINK.core.tornApiLimiter.reserve({ wait:true, script:'SLINK Market Watch', priority:'normal', endpoint });
    return SLINK.core.http.requestJson('tornApi', url, { headers:{ Authorization:`ApiKey ${key}` }, cache:'no-store' });
  }

  async function weaverJson(url) {
    const wait = Math.max(0, lastWeaverRequestAt + WEAVER_MIN_SPACING_MS - Date.now());
    if (wait) await new Promise(resolve => setTimeout(resolve, wait));
    lastWeaverRequestAt = Date.now();
    return SLINK.core.http.requestJson('weaver', url, { cache:'no-store' });
  }

  async function ensureCatalog({ force = false, key = '' } = {}) {
    const current = await runtime();
    if (!force && Array.isArray(current.catalog?.items) && current.catalog.items.length && Date.now() - Number(current.catalog.fetchedAt) < CATALOG_MAX_AGE_MS) return current.catalog;
    await accessState({ authenticate:true }).then(access => {
      if (!access.permitted) throw new Error('A signed SLINK Market Watch permission is required.');
    });
    const apiKey = key || await tornKey();
    const body = await tornJson('https://api.torn.com/v2/torn/items?cat=All&sort=ASC', apiKey, '/v2/torn/items');
    const items = MARKET.catalogItems(body);
    if (!items.length) throw new Error('Torn returned an empty item catalog.');
    current.catalog = { fetchedAt:Date.now(), items };
    await saveRuntime(current);
    return current.catalog;
  }

  function due(lastAt, priority, force) {
    if (force || !Number(lastAt)) return true;
    const minutes = Number(MARKET.PRIORITIES[priority]) || MARKET.PRIORITIES.normal;
    return Date.now() - Number(lastAt) >= minutes * 60_000;
  }

  async function refresh(force = false) {
    if (refreshing) return refreshing;
    refreshing = (async () => {
      const currentSettings = await settings();
      const access = await accessState({ authenticate:true });
      if (!access.permitted) throw new Error('Your account does not have a SLINK Market Watch tier.');
      if (!currentSettings.enabled) return publicStatus(false);
      const key = await tornKey();
      const current = await runtime();
      try {
        current.catalog = await ensureCatalog({ key });
        const allowed = currentSettings.watches.slice(0, access.limit);
        const validUids = new Set(allowed.map(watch => watch.uid));
        current.results = Object.fromEntries(Object.entries(current.results).filter(([uid]) => validUids.has(uid)));
        for (const watch of allowed) {
          if (!watch.enabled || !(watch.itemId > 0) || !(watch.maxPrice > 0)) continue;
          const previous = current.results[watch.uid] || {};
          const next = { ...previous, errors:{ ...(previous.errors || {}) } };
          if (!watch.marketEnabled) { delete next.market; delete next.errors.market; }
          if (!watch.bazaarEnabled) { delete next.bazaar; delete next.errors.bazaar; }
          if (watch.marketEnabled && due(previous?.market?.fetchedAt, watch.priority, force)) {
            try {
              const body = await tornJson(`https://api.torn.com/v2/market/${encodeURIComponent(watch.itemId)}/itemmarket?limit=5`, key, `/v2/market/${watch.itemId}/itemmarket`);
              next.market = { fetchedAt:Date.now(), listings:MARKET.itemMarketListings(body) };
              delete next.errors.market;
            } catch (error) {
              next.errors.market = SLINK.core.format.errorMessage(error);
            }
          }
          if (watch.bazaarEnabled && due(previous?.bazaar?.fetchedAt, watch.priority, force)) {
            try {
              const url = `https://weav3r.dev/api/marketplace/${encodeURIComponent(watch.itemId)}?maxPrice=${encodeURIComponent(watch.maxPrice)}&limit=5`;
              const body = await weaverJson(url);
              next.bazaar = { fetchedAt:Date.now(), sourceUrl:url, listings:MARKET.weaverListings(body, watch.itemId) };
              delete next.errors.bazaar;
            } catch (error) {
              next.errors.bazaar = SLINK.core.format.errorMessage(error);
            }
          }
          current.results[watch.uid] = next;
        }
        current.fetchedAt = Date.now();
        const sourceErrors = allowed.flatMap(watch => Object.entries(current.results[watch.uid]?.errors || {})
          .map(([source, message]) => `${watch.label || `Item ${watch.itemId}`} ${source}: ${message}`));
        current.lastError = sourceErrors.join(' · ');
      } catch (error) {
        current.lastError = SLINK.core.format.errorMessage(error);
      }
      await saveRuntime(current);
      return publicStatus(false);
    })();
    try { return await refreshing; }
    finally { refreshing = null; }
  }

  async function publicStatus(refreshIfDue = false) {
    const [currentSettings, current, access, usage] = await Promise.all([
      settings(), runtime(), accessState(), SLINK.core.tornApiLimiter.getUsage()
    ]);
    const configured = Boolean((await SLINK.services.permissionAccess.settings()).enabled);
    const allowed = currentSettings.watches.slice(0, access.limit || 0);
    const nextAt = allowed.filter(watch => watch.enabled).flatMap(watch => {
      const result = current.results[watch.uid] || {};
      const interval = (Number(MARKET.PRIORITIES[watch.priority]) || 5) * 60_000;
      return [watch.marketEnabled ? Number(result.market?.fetchedAt || 0) + interval : 0, watch.bazaarEnabled ? Number(result.bazaar?.fetchedAt || 0) + interval : 0].filter(Boolean);
    });
    if (refreshIfDue && configured && access.permitted && currentSettings.enabled && allowed.some(watch => {
      const result = current.results[watch.uid] || {};
      return (watch.marketEnabled && due(result.market?.fetchedAt, watch.priority, false)) || (watch.bazaarEnabled && due(result.bazaar?.fetchedAt, watch.priority, false));
    })) return refresh(false);
    return {
      configured,
      permitted:access.permitted,
      marketWatchLimit:access.limit,
      settings:currentSettings,
      catalog:current.catalog,
      results:current.results,
      opportunities:MARKET.opportunityRows(
        { ...current, catalog:current.catalog },
        { ...currentSettings, watches:allowed }
      ),
      fetchedAt:current.fetchedAt,
      nextRefreshAt:nextAt.length ? Math.min(...nextAt) : 0,
      lastError:current.lastError,
      tornApiUsage:usage
    };
  }

  async function saveSettings(input = {}) {
    const previous = await settings();
    const next = MARKET.normalizeSettings({ ...previous, ...input, watches:previous.watches });
    await SLINK.core.storage.set(KEYS.settings, next);
    return publicStatus(false);
  }

  async function upsertWatch(input = {}) {
    const access = await accessState({ authenticate:true });
    if (!access.permitted) throw new Error('A signed SLINK Market Watch permission is required.');
    const previous = await settings();
    const watch = MARKET.normalizeWatch(input, previous.watches.length);
    if (!(watch.itemId > 0)) throw new Error('Choose a Torn item.');
    if (!(watch.maxPrice > 0)) throw new Error('Enter a maximum price.');
    const catalog = await ensureCatalog();
    const item = catalog.items.find(row => Number(row.id) === watch.itemId);
    if (!item) throw new Error('That item is not in the current Torn item catalog.');
    watch.label = item.name;
    const index = previous.watches.findIndex(row => row.uid === watch.uid);
    const duplicate = previous.watches.findIndex(row => row.itemId === watch.itemId && row.uid !== watch.uid);
    if (duplicate >= 0) throw new Error(`${item.name} is already watched.`);
    if (index >= 0) previous.watches[index] = watch;
    else {
      if (previous.watches.length >= access.limit) throw new Error(`Your permission allows ${access.limit} Market Watch item${access.limit === 1 ? '' : 's'}.`);
      previous.watches.push(watch);
    }
    await SLINK.core.storage.set(KEYS.settings, MARKET.normalizeSettings(previous));
    const current = await runtime();
    delete current.results[watch.uid];
    await saveRuntime(current);
    // Only the new/edited watch is now due. Do not force every other watch to
    // consume another Torn and Weaver request merely because one row changed.
    return refresh(false);
  }

  async function removeWatch(payload = {}) {
    const previous = await settings();
    const uid = String(payload?.uid || '');
    previous.watches = previous.watches.filter(watch => watch.uid !== uid);
    await SLINK.core.storage.set(KEYS.settings, MARKET.normalizeSettings(previous));
    const current = await runtime();
    delete current.results[uid];
    await saveRuntime(current);
    return publicStatus(false);
  }

  async function ensureAlarm() {
    if (!await chrome.alarms.get(ALARM)) await chrome.alarms.create(ALARM, { delayInMinutes:1, periodInMinutes:1 });
  }

  const routes = Object.freeze({
    'market.status':payload => publicStatus(payload?.refreshIfDue === true),
    'market.refresh':() => refresh(true),
    'market.settings.save':saveSettings,
    'market.catalog':async payload => { await ensureCatalog({ force:payload?.force === true }); return publicStatus(false); },
    'market.watch.save':upsertWatch,
    'market.watch.remove':removeWatch
  });

  SLINK.define('services', 'market', Object.freeze({ ALARM, ensureAlarm, publicStatus, refresh, routes }));
})(globalThis);
