(function installAdhdService(global) {
  'use strict';

  const SLINK = global.SLINK_EXTENSION;
  const ADHD = SLINK.core.adhd;
  const ALARM = 'slink.adhd.alerts';
  const KEYS = Object.freeze({
    settings:'adhd.settings.v1',
    runtime:'adhd.runtime.v1',
    soundState:'adhd.sound.state.v1'
  });
  const USER_SELECTIONS = 'bars,cooldowns,travel,education,organizedcrime,refills,missions,casino,profile,races,enlistedcars,stocks,battlestats';
  let refreshing = null;

  async function settings() {
    return ADHD.normalizeSettings(await SLINK.core.storage.get(KEYS.settings, {}));
  }

  async function runtime() {
    return {
      fetchedAt:0,
      nextRefreshAt:0,
      lastError:'',
      snapshot:null,
      lastPurchase:null,
      ...(await SLINK.core.storage.get(KEYS.runtime, {}))
    };
  }

  async function saveRuntime(changes) {
    const next = { ...(await runtime()), ...changes };
    await SLINK.core.storage.set(KEYS.runtime, next);
    return next;
  }

  async function accessKey() {
    const current = await SLINK.services.permissionAccess.settings();
    return current.enabled ? String(current.tornKey || '').trim() : '';
  }

  async function tornJson(url, key) {
    await SLINK.core.tornApiLimiter.reserve({ wait:true });
    const response = await SLINK.core.http.requestJson('tornApi', url, {
      headers:{ Authorization:`ApiKey ${key}` },
      cache:'no-store'
    });
    if (response?.error) {
      const error = new Error(response.error.message || response.error.error || 'Torn API request failed.');
      error.code = 'SLINK_ADHD_TORN_ERROR';
      throw error;
    }
    return response;
  }

  function combinedUrl() {
    const url = new URL('https://api.torn.com/v2/user');
    url.searchParams.set('selections', USER_SELECTIONS);
    url.searchParams.set('comment', 'SLINK Efficiency alerts');
    return url.href;
  }

  function cityCurrentUrl() {
    const url = new URL('https://api.torn.com/v2/user/personalstats');
    url.searchParams.set('stat', 'cityitemsbought');
    url.searchParams.set('comment', 'SLINK Efficiency city total');
    return url.href;
  }

  function cityBaselineUrl(day) {
    const url = new URL('https://api.torn.com/v2/user/personalstats');
    url.searchParams.set('stat', 'cityitemsbought');
    url.searchParams.set('timestamp', String(Math.floor(day * ADHD.DAY_MS / 1000)));
    url.searchParams.set('comment', 'SLINK Efficiency city reset baseline');
    return url.href;
  }

  function cityShopsUrl() {
    const url = new URL('https://api.torn.com/v2/torn/cityshops');
    url.searchParams.set('comment', 'SLINK Efficiency city stock alerts');
    return url.href;
  }

  function apiUrl(path, comment) {
    const url = new URL(`https://api.torn.com/v2/${path}`);
    url.searchParams.set('comment', comment);
    return url.href;
  }

  async function clusterSnapshot(previous, key, settingsValue, now, force) {
    const enabled = settingsValue.enabled.clusterRing !== false || settingsValue.soundEnabled.clusterRing === true;
    if (!enabled) return previous || null;
    let cluster = previous && typeof previous === 'object' ? { ...previous } : {};
    if (!cluster.crimes || Number(cluster.crimesFetchedAt || 0) + ADHD.DAY_MS <= now) {
      cluster.crimes = await tornJson(apiUrl('user/4/crimes', 'SLINK Cluster Ring progress'), key);
      cluster.crimesFetchedAt = now;
    }
    if (ADHD.clusterRingAchieved(cluster.crimes)) return cluster;
    if (!cluster.subcrimes || Number(cluster.subcrimesFetchedAt || 0) + 7 * ADHD.DAY_MS <= now) {
      cluster.subcrimes = await tornJson(apiUrl('torn/4/subcrimes', 'SLINK Cluster Ring map'), key);
      cluster.subcrimesFetchedAt = now;
    }
    if (force || !cluster.status || Number(cluster.statusFetchedAt || 0) + 5 * 60_000 <= now) {
      cluster.status = await tornJson(apiUrl('torn/shoplifting', 'SLINK Cluster Ring status'), key);
      cluster.statusFetchedAt = now;
    }
    return cluster;
  }

  async function requireAccess() {
    const session = await SLINK.services.permissionAccess.ensureSession(false);
    if (!SLINK.core.permissions.hasScope(session, ADHD.ALERT_SCOPE)) {
      const error = new Error(`Your SLINK account does not have ${ADHD.ALERT_SCOPE} permission.`);
      error.code = 'SLINK_PERMISSION_DENIED';
      throw error;
    }
    return session;
  }

  async function refresh(force = false) {
    if (refreshing) return refreshing;
    refreshing = (async () => {
      const currentRuntime = await runtime();
      if (!force && currentRuntime.snapshot && Number(currentRuntime.nextRefreshAt) > Date.now()) return publicStatus(false);
      try {
        await requireAccess();
        const key = await accessKey();
        if (!key) throw new Error('Enable Efficiency and save your Torn API key first.');
        const now = Date.now();
        const day = ADHD.utcDay(now);
        const currentSettings = await settings();
        const [data, cityCurrent] = await Promise.all([
          tornJson(combinedUrl(), key),
          tornJson(cityCurrentUrl(), key)
        ]);
        const cityItemsBought = ADHD.personalStat(cityCurrent, 'cityitemsbought');
        let cityItemsAtReset = currentRuntime.snapshot?.day === day
          ? currentRuntime.snapshot.cityItemsAtReset
          : null;
        if (cityItemsAtReset === null || cityItemsAtReset === undefined) {
          const baseline = await tornJson(cityBaselineUrl(day), key);
          cityItemsAtReset = ADHD.personalStat(baseline, 'cityitemsbought');
        }
        if (cityItemsBought === null || cityItemsAtReset === null) {
          throw new Error('Torn returned no usable city-item purchase total.');
        }
        let lastPurchase = currentRuntime.lastPurchase || null;
        const previous = currentRuntime.snapshot;
        if (previous?.day === day && Number.isFinite(Number(previous.cityItemsBought)) && cityItemsBought > Number(previous.cityItemsBought)) {
          lastPurchase = { at:now, count:cityItemsBought - Number(previous.cityItemsBought), totalToday:Math.max(0, cityItemsBought - cityItemsAtReset) };
        }
        const progress = ADHD.cityProgress({ cityItemsBought, cityItemsAtReset }, currentSettings, now);
        const cityStockEnabled = ADHD.CITY_SHOP_TARGETS.some(target => currentSettings.cityStockAlerts[target.id] === true
          || currentSettings.soundEnabled[`cityStock:${target.id}`] === true);
        let cityShops = null;
        if (!progress.complete && cityStockEnabled) {
          const previousShops = currentRuntime.snapshot?.day === day ? currentRuntime.snapshot.cityShops : null;
          cityShops = !force && Number(previousShops?.fetchedAt) + 5 * 60_000 > now
            ? previousShops
            : { ...(await tornJson(cityShopsUrl(), key)), fetchedAt:now };
        }
        let cluster = currentRuntime.snapshot?.cluster || null;
        try {
          cluster = await clusterSnapshot(cluster, key, currentSettings, now, force);
          if (cluster?.lastError) cluster = { ...cluster, lastError:'' };
        } catch (clusterError) {
          cluster = { ...(cluster || {}), lastError:SLINK.core.format.errorMessage(clusterError), lastErrorAt:now };
        }
        const snapshot = { day, fetchedAt:now, data, cityItemsBought, cityItemsAtReset, cityShops, cluster };
        await saveRuntime({
          fetchedAt:now,
          nextRefreshAt:ADHD.nextRefreshAt(snapshot, currentSettings, now),
          lastError:'',
          snapshot,
          lastPurchase
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

  async function saveSettings(input = {}) {
    const previous = await settings();
    const enabled = { ...previous.enabled };
    if (input.enabled && typeof input.enabled === 'object') {
      for (const id of ADHD.ALL_ALERT_IDS) {
        if (Object.hasOwn(input.enabled, id)) enabled[id] = input.enabled[id] !== false;
      }
    }
    const soundEnabled = { ...previous.soundEnabled };
    if (input.soundEnabled && typeof input.soundEnabled === 'object') {
      for (const id of ADHD.ALL_ALERT_IDS) {
        if (Object.hasOwn(input.soundEnabled, id)) soundEnabled[id] = input.soundEnabled[id] === true;
      }
    }
    const cityStockAlerts = { ...previous.cityStockAlerts };
    if (input.cityStockAlerts && typeof input.cityStockAlerts === 'object') {
      for (const target of ADHD.CITY_SHOP_TARGETS) {
        if (Object.hasOwn(input.cityStockAlerts, target.id)) cityStockAlerts[target.id] = input.cityStockAlerts[target.id] === true;
      }
    }
    const next = ADHD.normalizeSettings({
      ...previous,
      medicalThresholdHours:Object.hasOwn(input, 'medicalThresholdHours') ? input.medicalThresholdHours : previous.medicalThresholdHours,
      boosterThresholdHours:Object.hasOwn(input, 'boosterThresholdHours') ? input.boosterThresholdHours : previous.boosterThresholdHours,
      landingLeadMinutes:Object.hasOwn(input, 'landingLeadMinutes') ? input.landingLeadMinutes : previous.landingLeadMinutes,
      playerAddictionThreshold:Object.hasOwn(input, 'playerAddictionThreshold') ? input.playerAddictionThreshold : previous.playerAddictionThreshold,
      enabled,
      soundEnabled,
      soundChoice:Object.hasOwn(input, 'soundChoice') ? input.soundChoice : previous.soundChoice,
      customSoundDataUrl:Object.hasOwn(input, 'customSoundDataUrl') ? input.customSoundDataUrl : previous.customSoundDataUrl,
      cityStockAlerts
    });
    await SLINK.core.storage.set(KEYS.settings, next);
    const currentRuntime = await runtime();
    if (currentRuntime.snapshot) await saveRuntime({ nextRefreshAt:ADHD.nextRefreshAt(currentRuntime.snapshot, next) });
    return publicStatus(false);
  }

  async function acknowledgeCity() {
    const next = await settings();
    next.cityDoneDay = ADHD.utcDay();
    await SLINK.core.storage.set(KEYS.settings, next);
    return publicStatus(false);
  }

  async function snooze(input = {}) {
    const id = String(input.id || '').trim();
    if (!ADHD.ALERT_DEFINITIONS.some(definition => definition.id === id) && !/^cityStock:\d+$/.test(id)) throw new Error('Unknown Efficiency alert.');
    const durationMs = Math.min(ADHD.DAY_MS, Math.max(60_000, Number(input.durationMs) || 60 * 60_000));
    const next = await settings();
    next.snoozedUntil[id] = Date.now() + durationMs;
    await SLINK.core.storage.set(KEYS.settings, next);
    return publicStatus(false);
  }

  async function claimSound() {
    const [currentSettings, currentRuntime, previous] = await Promise.all([
      settings(), runtime(), SLINK.core.storage.get(KEYS.soundState, { activeIds:[] })
    ]);
    const candidates = currentRuntime.snapshot
      ? ADHD.buildAlerts(currentRuntime.snapshot, currentSettings, Date.now(), { includeHidden:true })
        .filter(alert => currentSettings.soundEnabled[alert.id] === true)
      : [];
    const activeIds = candidates.map(alert => alert.id).sort();
    const oldIds = new Set(Array.isArray(previous?.activeIds) ? previous.activeIds : []);
    const newAlerts = candidates.filter(alert => !oldIds.has(alert.id));
    await SLINK.core.storage.set(KEYS.soundState, { activeIds, updatedAt:Date.now() });
    return {
      play:newAlerts.length > 0,
      alertIds:newAlerts.map(alert => alert.id),
      soundChoice:currentSettings.soundChoice,
      customSoundDataUrl:currentSettings.soundChoice === 'custom' ? currentSettings.customSoundDataUrl : ''
    };
  }

  async function publicStatus(refreshIfDue = true) {
    const [currentSettings, currentRuntime, access, permissions, usage] = await Promise.all([
      settings(),
      runtime(),
      SLINK.services.permissionAccess.status().catch(error => ({ configured:false, error:SLINK.core.format.errorMessage(error) })),
      SLINK.core.storage.get('permissions.snapshot', null),
      SLINK.core.tornApiLimiter.getUsage()
    ]);
    if (refreshIfDue && access.configured && Number(currentRuntime.nextRefreshAt || 0) <= Date.now()) {
      try { return await refresh(false); }
      catch {}
    }
    const permitted = SLINK.core.permissions.hasScope(permissions || {}, ADHD.ALERT_SCOPE);
    const snapshot = currentRuntime.snapshot;
    return {
      configured:Boolean(access.configured),
      permitted,
      requiredScope:ADHD.ALERT_SCOPE,
      settings:currentSettings,
      activeAlerts:snapshot ? ADHD.buildAlerts(snapshot, currentSettings) : [],
      city:snapshot ? ADHD.cityProgress(snapshot, currentSettings) : { bought:null, remaining:null, complete:false, manuallyDone:false },
      lastPurchase:currentRuntime.lastPurchase,
      fetchedAt:Number(currentRuntime.fetchedAt) || 0,
      nextRefreshAt:Number(currentRuntime.nextRefreshAt) || 0,
      lastError:String(currentRuntime.lastError || access.error || ''),
      marketWatchLimit:ADHD.marketWatchLimit(permissions || {}),
      tornApiUsage:usage
    };
  }

  async function ensureAlarm() {
    if (!await chrome.alarms.get(ALARM)) await chrome.alarms.create(ALARM, { delayInMinutes:1, periodInMinutes:1 });
    return chrome.alarms.get(ALARM);
  }

  const routes = Object.freeze({
    'adhd.status':payload => publicStatus(payload?.refreshIfDue !== false),
    'adhd.refresh':() => refresh(true),
    'adhd.settings.save':saveSettings,
    'adhd.city.acknowledge':acknowledgeCity,
    'adhd.alert.snooze':snooze,
    'adhd.sound.claim':claimSound
  });

  SLINK.define('services', 'adhd', Object.freeze({ ALARM, ensureAlarm, publicStatus, refresh, routes }));
})(globalThis);
