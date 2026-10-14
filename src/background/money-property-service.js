(function installMoneyPropertyService(global) {
  'use strict';

  const SLINK = global.SLINK_EXTENSION;
  const CORE = SLINK.core.moneyProperty;
  const KEYS = Object.freeze({
    settings:'money-property.settings.v1',
    runtime:'money-property.runtime.v1',
    catalog:'money-property.catalog.v1'
  });
  let refreshing = null;

  async function settings() {
    const stored = await SLINK.core.storage.get(KEYS.settings, {});
    return {
      ...CORE.normalizeSettings(stored),
      snoozedUntil:stored?.snoozedUntil && typeof stored.snoozedUntil === 'object' ? { ...stored.snoozedUntil } : {}
    };
  }

  async function runtime() {
    return { fetchedAt:0, status:null, lastError:'', ...(await SLINK.core.storage.get(KEYS.runtime, {})) };
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

  async function catalog(current, key, force = false) {
    if (!force && current?.fetchedAt && Date.now() - Number(current.fetchedAt) < CORE.CATALOG_MS
      && current.tornStocks && current.itemCatalog) return current;
    const [tornStocks, itemsBody] = await Promise.all([
      tornJson('https://api.torn.com/v2/torn/stocks?comment=SLINK%20money%20property%20stocks', key),
      tornJson('https://api.torn.com/v2/torn/items?sort=ASC&comment=SLINK%20money%20property%20items', key)
    ]);
    const itemCatalog = SLINK.core.market.catalogItems(itemsBody);
    const next = { fetchedAt:Date.now(), tornStocks, itemCatalog };
    await SLINK.core.storage.set(KEYS.catalog, next);
    return next;
  }

  async function refresh(force = false) {
    if (refreshing) return refreshing;
    refreshing = (async () => {
      await SLINK.services.permissionAccess.ensureSession(false, CORE.SCOPE);
      const [current, currentSettings, cachedCatalog] = await Promise.all([
        runtime(), settings(), SLINK.core.storage.get(KEYS.catalog, {})
      ]);
      if (!force && current.status && Date.now() - Number(current.fetchedAt || 0) < CORE.CACHE_MS) return publicStatus(false);
      const key = await tornKey();
      if (!key) throw new Error('Save your Torn API key under API and feature access first.');
      try {
        const [money, properties, stocks, achievementsResult, references] = await Promise.all([
          tornJson('https://api.torn.com/v2/user/money?comment=SLINK%20money%20property', key),
          tornJson('https://api.torn.com/v2/user/properties?limit=100&comment=SLINK%20money%20property', key),
          tornJson('https://api.torn.com/v2/user/stocks?comment=SLINK%20money%20property', key),
          tornJson('https://api.torn.com/v2/user?selections=honors,medals,merits&comment=SLINK%20money%20property', key).catch(() => ({})),
          catalog(cachedCatalog, key, false)
        ]);
        const user = {
          ...achievementsResult,
          money:money?.money || {},
          properties:properties?.properties || [],
          stocks:stocks?.stocks || []
        };
        const status = CORE.buildStatus({
          user,
          tornStocks:references.tornStocks,
          itemCatalog:references.itemCatalog
        }, currentSettings);
        await SLINK.core.storage.set(KEYS.runtime, { fetchedAt:Date.now(), status, lastError:'' });
      } catch (error) {
        await SLINK.core.storage.set(KEYS.runtime, { ...current, lastError:SLINK.core.format.errorMessage(error) });
        throw error;
      }
      return publicStatus(false);
    })();
    try { return await refreshing; }
    finally { refreshing = null; }
  }

  async function activeAlerts() {
    const [current, currentSettings] = await Promise.all([runtime(), settings()]);
    if (!current.status) return [];
    return CORE.buildAlerts(current.status, currentSettings)
      .filter(alert => Number(currentSettings.snoozedUntil[alert.id] || 0) <= Date.now());
  }

  async function publicStatus(refreshIfDue = true) {
    const [current, currentSettings, permissions] = await Promise.all([
      runtime(), settings(), SLINK.core.storage.get('permissions.snapshot', null)
    ]);
    const permitted = SLINK.core.permissions.hasScope(permissions || {}, CORE.SCOPE);
    if (refreshIfDue && permitted && (!current.status || Date.now() - Number(current.fetchedAt || 0) >= CORE.CACHE_MS)) {
      try { return await refresh(false); } catch {}
    }
    return {
      permitted,
      requiredScope:CORE.SCOPE,
      fetchedAt:Number(current.fetchedAt) || 0,
      lastError:String(current.lastError || ''),
      settings:currentSettings,
      status:current.status,
      activeAlerts:await activeAlerts()
    };
  }

  async function saveSettings(input = {}) {
    await SLINK.services.permissionAccess.ensureSession(false, CORE.SCOPE);
    const previous = await settings();
    const next = {
      ...CORE.normalizeSettings({ ...previous, ...input }),
      snoozedUntil:previous.snoozedUntil
    };
    await SLINK.core.storage.set(KEYS.settings, next);
    const current = await runtime();
    if (current.status) {
      current.status.settings = CORE.normalizeSettings(next);
      await SLINK.core.storage.set(KEYS.runtime, current);
    }
    return publicStatus(false);
  }

  async function toggleStockAlert(input = {}) {
    const previous = await settings();
    const key = String(input.key || '').trim();
    if (!key) throw new Error('Choose a stock benefit tier.');
    previous.stockAlerts[key] = input.enabled !== false;
    await SLINK.core.storage.set(KEYS.settings, previous);
    return publicStatus(false);
  }

  async function snooze(input = {}) {
    const previous = await settings();
    const id = String(input.id || '');
    if (!id.startsWith('money-property:')) throw new Error('Unknown Money & Property alert.');
    previous.snoozedUntil[id] = Date.now() + Math.min(86_400_000, Math.max(60_000, Number(input.durationMs) || 3_600_000));
    await SLINK.core.storage.set(KEYS.settings, previous);
    return publicStatus(false);
  }

  const routes = Object.freeze({
    'money-property.status':payload => publicStatus(payload?.refreshIfDue !== false),
    'money-property.refresh':() => refresh(true),
    'money-property.settings.save':saveSettings,
    'money-property.stock-alert':toggleStockAlert,
    'money-property.snooze':snooze
  });

  SLINK.define('services', 'moneyProperty', Object.freeze({
    activeAlerts,
    publicStatus,
    refresh,
    routes,
    settings,
    snooze
  }));
})(globalThis);
