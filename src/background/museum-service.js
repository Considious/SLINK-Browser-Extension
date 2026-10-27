(function installMuseumService(global) {
  'use strict';

  const SLINK = global.SLINK_EXTENSION;
  const MUSEUM = SLINK.core.museum;
  const KEYS = Object.freeze({ runtime:'museum.runtime.v1' });
  let refreshing = null;

  async function runtime() {
    return { fetchedAt:0, catalog:null, inventory:null, lastError:'', ...(await SLINK.core.storage.get(KEYS.runtime, {})) };
  }

  async function tornKey() {
    const [access, leveling, war] = await Promise.all([
      SLINK.services.permissionAccess.settings(),
      SLINK.core.storage.get('leveling.settings.v1', {}),
      SLINK.core.storage.get('war.settings.v1', {})
    ]);
    return String(access?.tornKey || leveling?.tornKey || war?.tornKey || '').trim();
  }

  async function tornJson(url, key) {
    await SLINK.core.tornApiLimiter.reserve({ wait:true });
    const response = await SLINK.core.http.requestJson('tornApi', url, {
      headers:{ Authorization:`ApiKey ${key}` },
      cache:'no-store'
    });
    if (response?.error) throw new Error(response.error.message || response.error.error || 'Torn API request failed.');
    return response;
  }

  async function fetchInventory(key) {
    const items = [];
    let offset = 0;
    for (let page = 0; page < 20; page += 1) {
      const body = await tornJson(`https://api.torn.com/v2/user/inventory?limit=250&offset=${offset}&comment=SLINK%20museum%20assistant`, key);
      const rows = Array.isArray(body?.inventory?.items) ? body.inventory.items : [];
      items.push(...rows);
      const total = Math.max(0, Number(body?._metadata?.total) || 0);
      if (rows.length < 250 || (total && items.length >= total)) break;
      offset += rows.length;
    }
    return { inventory:{ items, timestamp:Math.floor(Date.now() / 1000) } };
  }

  async function ensureCatalog(current, key, force = false) {
    return SLINK.services.sharedData.catalog({ key, force, maxAgeMs:MUSEUM.CATALOG_MS, needPrices:true });
  }

  async function refresh(force = false) {
    if (refreshing) return refreshing;
    refreshing = (async () => {
      await SLINK.services.permissionAccess.ensureSession(false, MUSEUM.SCOPE);
      const current = await runtime();
      if (!force && current.inventory && Date.now() - Number(current.fetchedAt || 0) < MUSEUM.CACHE_MS) return publicStatus(false);
      const key = await tornKey();
      if (!key) throw new Error('Save your Torn API key under API and feature access first.');
      try {
        const [inventory, catalog] = await Promise.all([
          fetchInventory(key),
          ensureCatalog(current, key, force)
        ]);
        await SLINK.core.storage.set(KEYS.runtime, { fetchedAt:Date.now(), inventory, catalog, lastError:'' });
      } catch (error) {
        await SLINK.core.storage.set(KEYS.runtime, { ...current, lastError:SLINK.core.format.errorMessage(error) });
        throw error;
      }
      return publicStatus(false);
    })();
    try { return await refreshing; }
    finally { refreshing = null; }
  }

  async function publicStatus(refreshIfDue = true) {
    const [current, permissions] = await Promise.all([
      runtime(),
      SLINK.core.storage.get('permissions.snapshot', null)
    ]);
    const permitted = SLINK.core.permissions.hasScope(permissions || {}, MUSEUM.SCOPE);
    if (refreshIfDue && permitted && (!current.inventory || Date.now() - Number(current.fetchedAt || 0) >= MUSEUM.CACHE_MS)) {
      try { return await refresh(false); } catch {}
    }
    const progress = current.inventory ? MUSEUM.buildStatus(current.inventory, current.catalog?.items || []) : { sets:[], summary:{ completed:0, total:MUSEUM.SETS.length, redeemablePoints:0 } };
    return {
      permitted,
      requiredScope:MUSEUM.SCOPE,
      fetchedAt:Number(current.fetchedAt) || 0,
      lastError:String(current.lastError || ''),
      ...progress
    };
  }

  async function trackAbroad(payload = {}) {
    await SLINK.services.permissionAccess.ensureSession(false, MUSEUM.SCOPE);
    const definition = MUSEUM.setById(payload.setId);
    if (!definition?.travel) throw new Error('That museum set does not use Abroad Stocks.');
    return SLINK.services.abroadStocks.addItemWatches(definition.items.map(entry => entry.name));
  }

  async function addMarketWatch(payload = {}) {
    const itemId = Math.trunc(Number(payload.itemId));
    const maxPrice = Math.trunc(Number(payload.maxPrice));
    const priority = String(payload.priority || 'normal');
    if (!Number.isSafeInteger(itemId) || itemId < 1 || !Number.isSafeInteger(maxPrice) || maxPrice < 1) throw new Error('Choose a museum item and enter a positive maximum price.');
    await SLINK.services.permissionAccess.ensureSession(false, MUSEUM.SCOPE);
    const result = await SLINK.services.market.routes['market.watch.save']({
      marketType:'item',
      itemId,
      maxPrice,
      priority,
      enabled:true,
      marketEnabled:true,
      bazaarEnabled:false
    });
    const watch = result?.settings?.watches?.find(row => row.marketType === 'item' && Number(row.itemId) === itemId && Number(row.maxPrice) === maxPrice);
    if (!watch) throw new Error('Market Watch did not confirm this item and price. Check Market Watch before trying again.');
    return {ok:true,itemId,maxPrice};
  }

  const routes = Object.freeze({
    'museum.status':payload => publicStatus(payload?.refreshIfDue !== false),
    'museum.refresh':() => refresh(true),
    'museum.abroad.track':trackAbroad,
    'museum.market.add':addMarketWatch
  });

  SLINK.define('services', 'museum', Object.freeze({ publicStatus, refresh, routes }));
})(globalThis);
