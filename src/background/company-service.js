(function installCompanyService(global) {
  'use strict';

  const SLINK = global.SLINK_EXTENSION;
  const COMPANY = SLINK.core.company;
  const KEYS = Object.freeze({
    settings:'company.settings.v1',
    runtime:'company.runtime.v1'
  });
  let refreshing = null;

  async function settings() {
    return COMPANY.normalizeSettings(await SLINK.core.storage.get(KEYS.settings, {}));
  }

  async function saveSettings(value = {}) {
    const next = COMPANY.normalizeSettings({ ...(await settings()), ...(value || {}) });
    await SLINK.core.storage.set(KEYS.settings, next);
    return publicStatus(false);
  }

  async function runtime() {
    return {
      fetchedAt:0,
      snapshot:null,
      lastError:'',
      ...(await SLINK.core.storage.get(KEYS.runtime, {}))
    };
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
    if (response?.error) {
      const error = new Error(response.error.message || response.error.error || 'Torn API request failed.');
      error.code = 'SLINK_COMPANY_TORN_ERROR';
      throw error;
    }
    return response;
  }

  async function refresh(force = false) {
    if (refreshing) return refreshing;
    refreshing = (async () => {
      const permissionSession = await SLINK.services.permissionAccess.ensureSession(false, COMPANY.SCOPE);
      const currentSettings = await settings();
      const cached = await runtime();
      const ttl = Math.max(5, Number(currentSettings.refreshMinutes) || 15) * 60_000;
      if (!force && cached.snapshot && Date.now() - Number(cached.fetchedAt || 0) < ttl) return publicStatus(false);
      const key = await tornKey();
      if (!key) throw new Error('Save your Torn API key under API and feature access first.');
      try {
        const [user, company] = await Promise.all([
          tornJson('https://api.torn.com/v2/user?selections=job%2Cjobpoints&comment=SLINK%20company%20assistant', key),
          tornJson('https://api.torn.com/v2/company?selections=profile%2Cemployees&comment=SLINK%20company%20assistant', key)
        ]);
        const snapshot = COMPANY.normalizeSnapshot(user, company, permissionSession?.userId, Date.now());
        await SLINK.core.storage.set(KEYS.runtime, { fetchedAt:Date.now(), snapshot, lastError:'' });
      } catch (error) {
        await SLINK.core.storage.set(KEYS.runtime, { ...cached, lastError:SLINK.core.format.errorMessage(error) });
        throw error;
      }
      return publicStatus(false);
    })();
    try { return await refreshing; }
    finally { refreshing = null; }
  }

  async function publicStatus(refreshIfDue = true) {
    const [currentSettings, currentRuntime, permissions] = await Promise.all([
      settings(),
      runtime(),
      SLINK.core.storage.get('permissions.snapshot', null)
    ]);
    const permitted = SLINK.core.permissions.hasScope(permissions || {}, COMPANY.SCOPE);
    const ttl = Math.max(5, Number(currentSettings.refreshMinutes) || 15) * 60_000;
    if (refreshIfDue && permitted && (!currentRuntime.snapshot || Date.now() - Number(currentRuntime.fetchedAt || 0) >= ttl)) {
      try { return await refresh(false); } catch {}
    }
    return {
      permitted,
      requiredScope:COMPANY.SCOPE,
      settings:currentSettings,
      snapshot:currentRuntime.snapshot,
      fetchedAt:Number(currentRuntime.fetchedAt) || 0,
      lastError:String(currentRuntime.lastError || ''),
      activeAlerts:permitted ? COMPANY.buildAlerts(currentRuntime.snapshot, currentSettings) : []
    };
  }

  async function activeAlerts() {
    try {
      const result = await publicStatus(true);
      return result.activeAlerts || [];
    } catch {
      return [];
    }
  }

  const routes = Object.freeze({
    'company.status':payload => publicStatus(payload?.refreshIfDue !== false),
    'company.refresh':() => refresh(true),
    'company.settings.save':payload => saveSettings(payload?.settings || payload)
  });

  SLINK.define('services', 'company', Object.freeze({
    activeAlerts,
    publicStatus,
    refresh,
    routes,
    saveSettings
  }));
})(globalThis);
