(function installEventsService(global) {
  'use strict';

  const SLINK = global.SLINK_EXTENSION;
  const CORE = SLINK.core.events;
  const KEYS = Object.freeze({
    runtime:'events.runtime.v1',
    settings:'events.settings.v1'
  });
  let refreshing = null;

  async function settings() {
    const stored = await SLINK.core.storage.get(KEYS.settings, {});
    return { selectedId:String(stored?.selectedId || '') };
  }

  async function runtime() {
    return { fetchedAt:0, calendar:null, lastError:'', ...(await SLINK.core.storage.get(KEYS.runtime, {})) };
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

  async function refresh(force = false) {
    if (refreshing) return refreshing;
    refreshing = (async () => {
      await SLINK.services.permissionAccess.ensureSession(false, CORE.SCOPE);
      const current = await runtime();
      if (!force && current.calendar && Date.now() - Number(current.fetchedAt || 0) < CORE.CACHE_MS) return publicStatus(false);
      const key = await tornKey();
      if (!key) throw new Error('Save your Torn API key under API and feature access first.');
      try {
        const [tornResult, userResult] = await Promise.allSettled([
          tornJson('https://api.torn.com/v2/torn/calendar?comment=SLINK%20events%20calendar', key),
          tornJson('https://api.torn.com/v2/user/calendar?comment=SLINK%20personal%20event%20times', key)
        ]);
        if (tornResult.status === 'rejected' && userResult.status === 'rejected') throw tornResult.reason;
        const calendar = CORE.mergeCalendars(
          tornResult.status === 'fulfilled' ? tornResult.value : {},
          userResult.status === 'fulfilled' ? userResult.value : {}
        );
        if (!calendar.events.length) throw new Error('Torn returned no calendar events.');
        await SLINK.core.storage.set(KEYS.runtime, { fetchedAt:Date.now(), calendar, lastError:'' });
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
    const [current, currentSettings, permissions] = await Promise.all([
      runtime(),
      settings(),
      SLINK.core.storage.get('permissions.snapshot', null)
    ]);
    const permitted = SLINK.core.permissions.hasScope(permissions || {}, CORE.SCOPE);
    if (refreshIfDue && permitted && (!current.calendar || Date.now() - Number(current.fetchedAt || 0) >= CORE.CACHE_MS)) {
      try { return await refresh(false); } catch {}
    }
    const selected = CORE.selectEvent(current.calendar || {}, currentSettings.selectedId);
    return {
      permitted,
      requiredScope:CORE.SCOPE,
      fetchedAt:Number(current.fetchedAt) || 0,
      lastError:String(current.lastError || ''),
      selectedId:selected?.id || '',
      selected,
      calendar:current.calendar
    };
  }

  async function saveSelection(input = {}) {
    await SLINK.services.permissionAccess.ensureSession(false, CORE.SCOPE);
    const current = await runtime();
    const id = String(input.id || '');
    if (id && !current.calendar?.events?.some(event => event.id === id)) throw new Error('Choose an event from the current Torn calendar.');
    await SLINK.core.storage.set(KEYS.settings, { selectedId:id });
    return publicStatus(false);
  }

  const routes = Object.freeze({
    'events.status':payload => publicStatus(payload?.refreshIfDue !== false),
    'events.refresh':() => refresh(true),
    'events.selection.save':saveSelection
  });

  SLINK.define('services', 'events', Object.freeze({ publicStatus, refresh, routes, settings }));
})(globalThis);
