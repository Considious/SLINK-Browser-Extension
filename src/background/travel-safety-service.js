(function installTravelSafetyService(global) {
  'use strict';

  const SLINK = global.SLINK_EXTENSION;
  const TRAVEL = SLINK.core.travelSafety;
  const CACHE_KEY = 'travelSafety.organizedCrime.v1';
  let refreshing = null;

  async function tornKey() {
    const [access, leveling, war] = await Promise.all([
      SLINK.core.storage.get('access.settings.v1', {}),
      SLINK.core.storage.get('leveling.settings.v1', {}),
      SLINK.core.storage.get('war.settings.v1', {})
    ]);
    return String(access?.tornKey || leveling?.tornKey || war?.tornKey || '').trim();
  }

  async function refresh(force = false) {
    if (refreshing) return refreshing;
    refreshing = (async () => {
      await SLINK.services.permissionAccess.ensureSession(false);
      const cached = await SLINK.core.storage.get(CACHE_KEY, null);
      if (!force && cached?.fetchedAt && Date.now() - Number(cached.fetchedAt) < TRAVEL.CACHE_MS) return cached;
      const key = await tornKey();
      if (!key) {
        const error = new Error('Save your Torn API key under API and feature access first.');
        error.code = 'SLINK_API_KEY_REQUIRED';
        throw error;
      }
      await SLINK.core.tornApiLimiter.reserve({ wait:true });
      const response = await SLINK.core.http.requestJson(
        'tornApi',
        'https://api.torn.com/v2/user/organizedcrime?comment=SLINK%20travel%20safety',
        { headers:{ Authorization:`ApiKey ${key}` }, cache:'no-store' }
      );
      if (response?.error) {
        const error = new Error(response.error.message || response.error.error || 'Torn API request failed.');
        error.code = 'SLINK_TRAVEL_SAFETY_TORN_ERROR';
        throw error;
      }
      const next = { fetchedAt:Date.now(), crime:TRAVEL.normalizeCrime(response) };
      await SLINK.core.storage.set(CACHE_KEY, next);
      return next;
    })();
    try { return await refreshing; }
    finally { refreshing = null; }
  }

  async function status(payload = {}) {
    const data = await refresh(payload.force === true);
    return { enabled:true, bufferRatio:TRAVEL.BUFFER_RATIO, ...data };
  }

  const routes = Object.freeze({ 'travelSafety.status':status });
  SLINK.define('services', 'travelSafety', Object.freeze({ refresh, routes, status }));
})(globalThis);

