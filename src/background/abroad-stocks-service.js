(function installAbroadStocksService(global) {
  'use strict';

  const SLINK = global.SLINK_EXTENSION;
  const ABROAD = SLINK.core.abroadStocks;
  const ALARM = 'slink.abroad-stocks';
  const CACHE_MS = 60_000;
  const ACTIVITY_MS = 5 * 60_000;
  const KEYS = Object.freeze({
    settings:'abroadStocks.settings.v1',
    runtime:'abroadStocks.runtime.v1',
    history:'abroadStocks.history.v1',
    watches:'abroadStocks.watches.v1',
    snoozes:'abroadStocks.snoozes.v1'
  });
  let refreshing = null;

  function normalizeSettings(input = {}) {
    return {
      travelMethod:Object.hasOwn(ABROAD.TRAVEL_MULTIPLIERS, input?.travelMethod) ? input.travelMethod : 'private',
      arrivalBufferMinutes:Math.min(30, Math.max(0, Number(input?.arrivalBufferMinutes) || 3)),
      alertLeadMinutes:Math.min(180, Math.max(0, Number(input?.alertLeadMinutes) || 10)),
      alertsEnabled:input?.alertsEnabled !== false,
      soundEnabled:input?.soundEnabled === true,
      tornIntelKey:String(input?.tornIntelKey || '').trim().slice(0, 256),
      useDroqs:input?.useDroqs !== false
    };
  }

  async function settings() {
    return normalizeSettings(await SLINK.core.storage.get(KEYS.settings, {}));
  }

  async function runtime() {
    return {
      fetchedAt:0,
      activeUntil:0,
      snapshots:{},
      rows:[],
      providers:{},
      ...(await SLINK.core.storage.get(KEYS.runtime, {}))
    };
  }

  async function watches() {
    const value = await SLINK.core.storage.get(KEYS.watches, []);
    return Array.isArray(value) ? value.filter(entry => entry && entry.key) : [];
  }

  async function requestProvider(providerId, currentSettings) {
    const definition = ABROAD.PROVIDERS[providerId];
    const capability = {
      yata:'yataTravel',
      prometheus:'prometheusTravel',
      tornIntel:'tornIntelTravel',
      droqs:'droqsTravel'
    }[providerId];
    const headers = {};
    if (providerId === 'tornIntel' && currentSettings.tornIntelKey) headers['X-Torn-Intel-Key'] = currentSettings.tornIntelKey;
    const payload = await SLINK.core.http.requestJson(capability, definition.url, {
      headers,
      cache:'no-store'
    });
    return ABROAD.normalizeProvider(providerId, payload, Date.now());
  }

  function updateHistory(currentHistory, snapshots) {
    const history = currentHistory && typeof currentHistory === 'object' ? { ...currentHistory } : {};
    for (const [providerId, providerRows] of Object.entries(snapshots || {})) {
      if (ABROAD.PROVIDERS[providerId]?.enrichment) continue;
      for (const row of Array.isArray(providerRows) ? providerRows : []) {
        const mapKey = ABROAD.itemKey(row);
        const entry = history[mapKey] && typeof history[mapKey] === 'object'
          ? { ...history[mapKey], providers:{ ...(history[mapKey].providers || {}) }, restocks:[...(history[mapKey].restocks || [])] }
          : { providers:{}, restocks:[] };
        const previous = entry.providers[providerId];
        const updatedAt = Number(row.updatedAt) || Date.now();
        const quantity = Number.isFinite(Number(row.quantity)) ? Number(row.quantity) : null;
        if (previous && quantity !== null && previous.quantity !== null
          && updatedAt > Number(previous.updatedAt || 0) && quantity > Number(previous.quantity)) {
          const eventAt = updatedAt;
          if (!entry.restocks.some(value => Math.abs(Number(value) - eventAt) < 5 * 60_000)) entry.restocks.push(eventAt);
        }
        if (Number(row.lastRestockAt) > 0 && !entry.restocks.some(value => Math.abs(Number(value) - Number(row.lastRestockAt)) < 5 * 60_000)) {
          entry.restocks.push(Number(row.lastRestockAt));
        }
        entry.restocks = [...new Set(entry.restocks.map(Number).filter(Number.isFinite))].sort((a,b) => a-b).slice(-8);
        entry.providers[providerId] = { quantity, updatedAt };
        entry.updatedAt = Date.now();
        history[mapKey] = entry;
      }
    }
    const recent = Object.entries(history)
      .sort((left,right) => Number(right[1]?.updatedAt || 0) - Number(left[1]?.updatedAt || 0))
      .slice(0, 750);
    return Object.fromEntries(recent);
  }

  async function refresh(force = false) {
    if (refreshing) return refreshing;
    refreshing = (async () => {
      const now = Date.now();
      const [currentRuntime, currentSettings, currentWatches] = await Promise.all([runtime(), settings(), watches()]);
      if (!force && Number(currentRuntime.fetchedAt) + CACHE_MS > now) return publicStatus(false);
      if (!force && Number(currentRuntime.activeUntil) <= now && !currentWatches.length) return publicStatus(false);

      const providerIds = ['yata','prometheus','tornIntel', ...(currentSettings.useDroqs ? ['droqs'] : [])];
      const settled = await Promise.allSettled(providerIds.map(providerId => requestProvider(providerId, currentSettings)));
      const snapshots = { ...(currentRuntime.snapshots || {}) };
      const providers = { ...(currentRuntime.providers || {}) };
      settled.forEach((result,index) => {
        const providerId = providerIds[index];
        if (result.status === 'fulfilled') {
          snapshots[providerId] = result.value;
          providers[providerId] = { ok:true, fetchedAt:now, rows:result.value.length, error:'', needsKey:false };
        } else {
          const error = result.reason;
          const status = Number(error?.status || 0);
          const needsKey = providerId === 'tornIntel' && [401,403].includes(status);
          providers[providerId] = {
            ok:false,
            fetchedAt:Number(providers[providerId]?.fetchedAt || 0),
            rows:Array.isArray(snapshots[providerId]) ? snapshots[providerId].length : 0,
            error:ABROAD.PROVIDERS[providerId]?.enrichment ? '' : SLINK.core.format.errorMessage(error),
            needsKey
          };
        }
      });

      const previousHistory = await SLINK.core.storage.get(KEYS.history, {});
      const history = updateHistory(previousHistory, snapshots);
      const mergedRows = ABROAD.mergeSnapshots(snapshots, history);
      await Promise.all([
        SLINK.core.storage.set(KEYS.history, history),
        SLINK.core.storage.set(KEYS.runtime, {
          ...currentRuntime,
          fetchedAt:now,
          snapshots,
          providers,
          rows:mergedRows
        })
      ]);
      return publicStatus(false);
    })();
    try { return await refreshing; }
    finally { refreshing = null; }
  }

  async function touchActivity() {
    const current = await runtime();
    await SLINK.core.storage.set(KEYS.runtime, { ...current, activeUntil:Date.now() + ACTIVITY_MS });
    return publicStatus(true);
  }

  async function saveSettings(input = {}) {
    const next = normalizeSettings(input);
    await SLINK.core.storage.set(KEYS.settings, next);
    return publicStatus(false);
  }

  async function toggleWatch(input = {}) {
    const mapKey = String(input.key || '').trim();
    if (!mapKey) throw new Error('An abroad-stock row is required.');
    const current = await watches();
    const existing = current.findIndex(entry => entry.key === mapKey);
    if (input.enabled === false || existing >= 0) {
      if (existing >= 0) current.splice(existing, 1);
    } else {
      current.push({
        key:mapKey,
        countryCode:String(input.countryCode || ''),
        countryName:String(input.countryName || ''),
        itemId:Number(input.itemId) || null,
        itemName:String(input.itemName || '')
      });
    }
    await SLINK.core.storage.set(KEYS.watches, current);
    return publicStatus(false);
  }

  async function snoozeAlert(input = {}) {
    const id = String(input.id || '');
    if (!id.startsWith('abroad:')) throw new Error('Unknown Abroad Stocks alert.');
    const durationMs = Math.min(24 * 60 * 60_000, Math.max(60_000, Number(input.durationMs) || 60 * 60_000));
    const snoozes = await SLINK.core.storage.get(KEYS.snoozes, {});
    snoozes[id] = Date.now() + durationMs;
    await SLINK.core.storage.set(KEYS.snoozes, snoozes);
    return { ok:true };
  }

  async function activeAlerts(now = Date.now()) {
    const [currentRuntime, currentSettings, currentWatches, snoozes] = await Promise.all([
      runtime(), settings(), watches(), SLINK.core.storage.get(KEYS.snoozes, {})
    ]);
    if (!currentSettings.alertsEnabled) return [];
    const byKey = new Map((currentRuntime.rows || []).map(row => [row.key, row]));
    return currentWatches.flatMap(watch => {
      const row = byKey.get(watch.key);
      const nextRestockAt = Number(row?.nextRestockAt) || 0;
      const leaveAt = ABROAD.departureAt(row, currentSettings);
      if (!row || !nextRestockAt || !leaveAt) return [];
      const alertAt = leaveAt - currentSettings.alertLeadMinutes * 60_000;
      if (now < alertAt || now > nextRestockAt + 30 * 60_000) return [];
      const id = 'abroad:' + row.countryCode + ':' + (row.itemId || row.itemName) + ':' + nextRestockAt;
      if (Number(snoozes?.[id] || 0) > now) return [];
      const leaveText = ABROAD.formatTct(leaveAt);
      const restockText = ABROAD.formatTct(nextRestockAt);
      return [{
        id,
        title:'Leave for ' + row.countryName + ' — ' + row.itemName,
        detail:'Leave at ' + leaveText + ' to arrive near the estimated ' + restockText + ' restock.',
        tone:'urgent',
        timerSeconds:Math.max(0, Math.ceil((leaveAt - now) / 1000)),
        links:[['Travel Agency','https://www.torn.com/travelagency.php']],
        shareText:'Abroad Stocks | ' + row.itemName + ' in ' + row.countryName + ' | Leave ' + leaveText + ' | Estimated restock ' + restockText
      }];
    });
  }

  async function publicStatus(refreshIfDue = true) {
    const [currentRuntime, currentSettings, currentWatches] = await Promise.all([runtime(), settings(), watches()]);
    if (refreshIfDue && Number(currentRuntime.fetchedAt) + CACHE_MS <= Date.now()) {
      try { return await refresh(false); } catch {}
    }
    const watched = new Set(currentWatches.map(entry => entry.key));
    return {
      settings:currentSettings,
      fetchedAt:Number(currentRuntime.fetchedAt) || 0,
      providers:currentRuntime.providers || {},
      rows:(currentRuntime.rows || []).map(row => ({ ...row, watched:watched.has(row.key), departureAt:ABROAD.departureAt(row, currentSettings) })),
      watches:currentWatches,
      activeUntil:Number(currentRuntime.activeUntil) || 0,
      activeAlerts:await activeAlerts()
    };
  }

  async function ensureAlarm() {
    if (!await chrome.alarms.get(ALARM)) await chrome.alarms.create(ALARM, { delayInMinutes:1, periodInMinutes:1 });
    return chrome.alarms.get(ALARM);
  }

  const routes = Object.freeze({
    'abroadStocks.status':payload => publicStatus(payload?.refreshIfDue !== false),
    'abroadStocks.refresh':() => refresh(true),
    'abroadStocks.activity.touch':() => touchActivity(),
    'abroadStocks.settings.save':payload => saveSettings(payload?.settings || payload),
    'abroadStocks.watch.toggle':payload => toggleWatch(payload),
    'abroadStocks.alert.snooze':payload => snoozeAlert(payload)
  });

  SLINK.define('services', 'abroadStocks', Object.freeze({
    ALARM,
    activeAlerts,
    ensureAlarm,
    publicStatus,
    refresh,
    routes,
    snoozeAlert,
    touchActivity
  }));
})(globalThis);
