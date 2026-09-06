(function installMeritsService(global) {
  'use strict';

  const SLINK = global.SLINK_EXTENSION;
  const MERITS = SLINK.core.merits;
  const KEYS = Object.freeze({ settings:'merits.settings.v1', runtime:'merits.runtime.v1' });
  let refreshing = null;

  async function settings() {
    return MERITS.normalizeSettings(await SLINK.core.storage.get(KEYS.settings, {}));
  }

  async function runtime() {
    return {
      fetchedAt:0,
      nextRefreshAt:0,
      catalogFetchedAt:0,
      lastError:'',
      snapshot:null,
      ...(await SLINK.core.storage.get(KEYS.runtime, {}))
    };
  }

  async function accessKey() {
    const current = await SLINK.services.permissionAccess.settings();
    return current.enabled ? String(current.tornKey || '').trim() : '';
  }

  async function requireAccess() {
    const session = await SLINK.services.permissionAccess.ensureSession(false);
    if (!SLINK.core.permissions.hasScope(session, MERITS.REQUIRED_SCOPE)) {
      const error = new Error(`Your SLINK account does not have ${MERITS.REQUIRED_SCOPE} permission.`);
      error.code = 'SLINK_PERMISSION_DENIED';
      throw error;
    }
    return session;
  }

  async function tornJson(url, key) {
    await SLINK.core.tornApiLimiter.reserve({ wait:true, script:'SLINK Extension', endpoint:new URL(url).pathname });
    const response = await SLINK.core.http.requestJson('tornApi', url, {
      headers:{ Authorization:`ApiKey ${key}` },
      cache:'no-store'
    });
    if (response?.error) {
      const error = new Error(response.error.message || response.error.error || 'Torn API request failed.');
      error.code = 'SLINK_MERITS_TORN_ERROR';
      throw error;
    }
    return response;
  }

  function apiUrl(path, query, comment) {
    const url = new URL(`https://api.torn.com/v2/${path}`);
    for (const [name, value] of Object.entries(query || {})) url.searchParams.set(name, value);
    url.searchParams.set('comment', comment);
    return url.href;
  }

  function playerUrl() {
    return apiUrl('user', { selections:'profile,faction,medals,honors,merits' }, 'SLINK Merit completion');
  }

  function personalStatsUrl() {
    return apiUrl('user/personalstats', { cat:'all' }, 'SLINK Merit progress');
  }

  function catalogUrl() {
    return apiUrl('torn', { selections:'medals,honors' }, 'SLINK Merit catalog');
  }

  async function saveRuntime(changes) {
    const next = { ...(await runtime()), ...changes };
    await SLINK.core.storage.set(KEYS.runtime, next);
    return next;
  }

  async function refresh(force = false, forceCatalog = false) {
    if (refreshing) return refreshing;
    refreshing = (async () => {
      const before = await runtime();
      const currentSettings = await settings();
      if (!force && before.snapshot && Number(before.nextRefreshAt) > Date.now()) return publicStatus(false);
      try {
        await requireAccess();
        const key = await accessKey();
        if (!key) throw new Error('Enable Efficiency and save your Torn API key first.');
        const now = Date.now();
        const catalogDue = forceCatalog || !before.snapshot?.catalogMedals?.length || !before.snapshot?.catalogHonors?.length
          || Number(before.catalogFetchedAt) + MERITS.CATALOG_MAX_AGE_MS <= now;
        const [playerResult, statsResult, catalogResult] = await Promise.allSettled([
          tornJson(playerUrl(), key),
          tornJson(personalStatsUrl(), key),
          catalogDue ? tornJson(catalogUrl(), key) : Promise.resolve(null)
        ]);
        const errors = [];
        const snapshot = { ...(before.snapshot || {}) };
        if (playerResult.status === 'fulfilled') {
          const body = playerResult.value;
          if (!Array.isArray(body?.medals) || !Array.isArray(body?.honors)) errors.push('Torn returned incomplete achieved-award data; the prior completion list was kept.');
          else {
            snapshot.medals = body.medals;
            snapshot.honors = body.honors;
            snapshot.merits = body?.merits || null;
            snapshot.profile = MERITS.profileFromBody(body);
          }
        } else errors.push(SLINK.core.format.errorMessage(playerResult.reason));
        if (statsResult.status === 'fulfilled') {
          const personalStats = MERITS.numericPersonalStats(statsResult.value);
          if (Object.keys(personalStats).length) {
            snapshot.personalStats = personalStats;
            snapshot.finishingHits = MERITS.finishingHitsFromPersonalStats(statsResult.value);
          } else errors.push('Torn returned no personal-stat counters, so existing progress counters were kept.');
        } else errors.push(SLINK.core.format.errorMessage(statsResult.reason));
        let catalogFetchedAt = Number(before.catalogFetchedAt) || 0;
        if (catalogResult.status === 'fulfilled' && catalogResult.value) {
          const body = catalogResult.value;
          if (!Array.isArray(body?.medals) || !Array.isArray(body?.honors)) errors.push('Torn returned an incomplete award catalog; the prior catalog was kept.');
          else {
            snapshot.catalogMedals = body.medals;
            snapshot.catalogHonors = body.honors;
            catalogFetchedAt = now;
          }
        } else if (catalogResult.status === 'rejected') errors.push(SLINK.core.format.errorMessage(catalogResult.reason));
        if (!snapshot.catalogMedals?.length || !snapshot.catalogHonors?.length) throw new Error(errors.join(' ') || 'The Torn award catalog is unavailable.');
        if (!snapshot.medals || !snapshot.honors) throw new Error(errors.join(' ') || 'Your achieved awards are unavailable.');
        snapshot.fetchedAt = now;
        await saveRuntime({
          fetchedAt:now,
          nextRefreshAt:now + currentSettings.refreshMinutes * 60_000,
          catalogFetchedAt,
          lastError:errors.join(' '),
          snapshot
        });
        return publicStatus(false);
      } catch (error) {
        await saveRuntime({ lastError:SLINK.core.format.errorMessage(error), nextRefreshAt:Date.now() + 5 * 60_000 });
        throw error;
      }
    })();
    try { return await refreshing; }
    finally { refreshing = null; }
  }

  async function publicStatus(refreshIfDue = true) {
    const [currentSettings, currentRuntime, access, permissions, usage] = await Promise.all([
      settings(), runtime(),
      SLINK.services.permissionAccess.status().catch(error => ({ configured:false, error:SLINK.core.format.errorMessage(error) })),
      SLINK.core.storage.get('permissions.snapshot', null),
      SLINK.core.tornApiLimiter.getUsage()
    ]);
    if (refreshIfDue && access.configured && Number(currentRuntime.nextRefreshAt || 0) <= Date.now()) {
      try { return await refresh(false); }
      catch {}
    }
    const permitted = SLINK.core.permissions.hasScope(permissions || {}, MERITS.REQUIRED_SCOPE);
    const view = currentRuntime.snapshot ? MERITS.buildView(currentRuntime.snapshot, currentSettings) : MERITS.buildView({}, currentSettings);
    return {
      configured:Boolean(access.configured),
      permitted,
      requiredScope:MERITS.REQUIRED_SCOPE,
      settings:view.settings,
      goals:view.goals,
      pinned:view.pinned,
      completedCount:view.completedCount,
      totalCount:view.totalCount,
      availableMerits:view.availableMerits,
      fetchedAt:Number(currentRuntime.fetchedAt) || 0,
      nextRefreshAt:Number(currentRuntime.nextRefreshAt) || 0,
      lastError:String(currentRuntime.lastError || access.error || ''),
      tornApiUsage:usage
    };
  }

  async function saveSettings(input = {}) {
    const previous = await settings();
    const next = MERITS.normalizeSettings({ ...previous, ...input, pinned:previous.pinned });
    await SLINK.core.storage.set(KEYS.settings, next);
    const current = await runtime();
    if (current.snapshot) await saveRuntime({ nextRefreshAt:Number(current.fetchedAt || Date.now()) + next.refreshMinutes * 60_000 });
    return publicStatus(false);
  }

  async function setPinned(input = {}) {
    const key = String(input.key || '');
    if (!/^(?:medal|honor):\d+$/.test(key)) throw new Error('Choose a valid medal or honor.');
    const stored = await settings();
    const currentRuntime = await runtime();
    const current = currentRuntime.snapshot ? MERITS.buildView(currentRuntime.snapshot, stored).settings : stored;
    const remove = input.pinned === false || current.pinned.includes(key);
    const pinned = remove ? current.pinned.filter(value => value !== key) : [...current.pinned, key];
    if (pinned.length > MERITS.TRACK_LIMIT) throw new Error(`You can pin up to ${MERITS.TRACK_LIMIT} active Merit farms.`);
    await SLINK.core.storage.set(KEYS.settings, MERITS.normalizeSettings({ ...current, pinned }));
    return publicStatus(false);
  }

  const routes = Object.freeze({
    'merits.status':payload => publicStatus(payload?.refreshIfDue !== false),
    'merits.refresh':payload => refresh(true, payload?.forceCatalog === true),
    'merits.settings.save':saveSettings,
    'merits.pin':setPinned
  });

  SLINK.define('services', 'merits', Object.freeze({ publicStatus, refresh, routes }));
})(globalThis);
