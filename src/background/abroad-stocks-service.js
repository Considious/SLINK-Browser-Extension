(function installAbroadStocksService(global) {
  'use strict';

  const SLINK = global.SLINK_EXTENSION;
  const ABROAD = SLINK.core.abroadStocks;
  const ALARM = 'slink.abroad-stocks';
  const CACHE_MS = 60_000;
  const MARKET_CACHE_MS = 60 * 60_000;
  const LANDING_LEAD_MS = 2 * 60_000;
  const LANDING_ALERT_GRACE_MS = 10 * 60_000;
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
    const explicit = input?.travelMethodExplicit === true;
    const detectedDefault = input?.travelDefault === 'airstrip' ? 'airstrip' : 'standard';
    return {
      travelMethod:explicit && Object.hasOwn(ABROAD.TRAVEL_MULTIPLIERS, input?.travelMethod) ? input.travelMethod : detectedDefault,
      travelMethodExplicit:explicit,
      travelDefault:detectedDefault,
      arrivalBufferMinutes:Math.min(30, Math.max(0, Number(input?.arrivalBufferMinutes) || 3)),
      alertLeadMinutes:Math.min(180, Math.max(0, Number(input?.alertLeadMinutes) || 10)),
      alertsEnabled:input?.alertsEnabled !== false,
      soundEnabled:input?.soundEnabled === true,
      landingRecommendationEnabled:input?.landingRecommendationEnabled !== false,
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
      marketPrices:{},
      marketPricesFetchedAt:0,
      landingCheckedArrivalAt:0,
      landingRecommendation:null,
      ...(await SLINK.core.storage.get(KEYS.runtime, {}))
    };
  }

  async function watches() {
    const value = await SLINK.core.storage.get(KEYS.watches, []);
    return Array.isArray(value) ? value.filter(entry => entry && entry.key) : [];
  }

  async function tornKey() {
    const [access, leveling, war] = await Promise.all([
      SLINK.services.permissionAccess.settings(),
      SLINK.core.storage.get('leveling.settings.v1', {}),
      SLINK.core.storage.get('war.settings.v1', {})
    ]);
    return String(access?.tornKey || leveling?.tornKey || war?.tornKey || '').trim();
  }

  async function detectTravelDefault(currentRuntime, currentSettings) {
    if (currentSettings.travelMethodExplicit) return currentSettings;
    const checkedAt = Number(currentRuntime.travelDefaultCheckedAt) || 0;
    if (checkedAt && Date.now() - checkedAt < 24 * 60 * 60_000) return currentSettings;
    const key = await tornKey();
    if (!key) return currentSettings;
    try {
      await SLINK.core.tornApiLimiter.reserve({ wait:true });
      const response = await SLINK.core.http.requestJson('tornApi', 'https://api.torn.com/v2/user/property?comment=SLINK%20abroad%20travel%20default', {
        headers:{ Authorization:`ApiKey ${key}` },
        cache:'no-store'
      });
      if (response?.error) throw new Error(response.error.message || 'Torn property request failed.');
      const property = response?.property || {};
      const hasAirstrip = Array.isArray(property?.modifications)
        && property.modifications.some(value => /airstrip/i.test(String(value || '')));
      const next = normalizeSettings({ ...currentSettings, travelDefault:hasAirstrip ? 'airstrip' : 'standard' });
      await SLINK.core.storage.set(KEYS.settings, next);
      currentRuntime.travelDefaultCheckedAt = Date.now();
      currentRuntime.hasAirstrip = hasAirstrip;
      return next;
    } catch {
      currentRuntime.travelDefaultCheckedAt = Date.now();
      currentRuntime.hasAirstrip = false;
      return currentSettings;
    }
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

  function travelContext(currentRuntime, now = Date.now()) {
    const travel = currentRuntime?.snapshot?.data?.travel || {};
    const destination = String(travel.destination || travel.country || travel.location || '').trim();
    let arrivalAt = Number(travel.arrival_at || travel.arrivalAt || 0);
    if (arrivalAt > 0 && arrivalAt < 10_000_000_000) arrivalAt *= 1000;
    if (!arrivalAt) {
      const seconds = Number(travel.time_left || travel.timeLeft || 0);
      const observedAt = Number(currentRuntime?.snapshot?.mobilityFetchedAt || currentRuntime?.fetchedAt || now);
      if (seconds > 0) arrivalAt = observedAt + seconds * 1000;
    }
    const country = ABROAD.countryRecord(destination);
    return destination && country && arrivalAt > now - LANDING_ALERT_GRACE_MS
      ? { arrivalAt, countryCode:country.code, countryName:country.name }
      : null;
  }

  async function currentTravelContext(now = Date.now()) {
    const adhdRuntime = await SLINK.core.storage.get('adhd.runtime.v1', {});
    return travelContext(adhdRuntime, now);
  }

  function marketPriceRows(payload) {
    const value = payload?.items ?? payload?.data?.items ?? payload?.data ?? [];
    if (Array.isArray(value)) return value;
    if (value && typeof value === 'object') {
      return Object.entries(value).map(([id,row]) => ({ id:Number(row?.id || id) || id, ...(row || {}) }));
    }
    return [];
  }

  function marketPriceMap(payload) {
    const prices = {};
    for (const row of marketPriceRows(payload)) {
      const id = Number(row?.id || row?.item_id || row?.itemId || 0);
      const price = Number(row?.market_price ?? row?.marketPrice ?? row?.market_value ?? row?.marketValue
        ?? row?.value?.market_price ?? row?.value?.marketPrice ?? row?.value?.market_value ?? row?.value?.marketValue);
      if (id > 0 && price > 0) prices[id] = price;
    }
    return prices;
  }

  async function ensureMarketPrices(currentRuntime, now = Date.now()) {
    const key = await tornKey();
    if (!key) throw new Error('Save a Torn API key before enabling landing purchase recommendations.');
    const catalog = await SLINK.services.sharedData.catalog({ key, maxAgeMs:MARKET_CACHE_MS, needPrices:true });
    const prices = marketPriceMap({ items:catalog.items });
    if (!Object.keys(prices).length) throw new Error('Torn returned no item market prices.');
    currentRuntime.marketPrices = prices;
    currentRuntime.marketPricesFetchedAt = catalog.pricesAt;
    return prices;
  }

  function bestLandingRecommendation(rows, marketPrices, travel, now = Date.now()) {
    const candidates = [];
    for (const row of rows || []) {
      if (String(row.countryCode || '').toUpperCase() !== String(travel.countryCode || '').toUpperCase()) continue;
      const marketPrice = Number(marketPrices?.[Number(row.itemId)]) || 0;
      if (!marketPrice) continue;
      const available = ['yata','prometheus','tornIntel'].map(providerId => ({ providerId, ...(row.sources?.[providerId] || {}) }))
        .filter(source => Number(source.quantity) > 0 && Number(source.cost) > 0)
        .sort((left,right) => Number(right.updatedAt || 0) - Number(left.updatedAt || 0));
      const source = available[0];
      if (!source) continue;
      const cost = Number(source.cost);
      const profit = marketPrice - cost;
      const roi = profit / cost;
      if (!(profit > 0) || !(roi > 0)) continue;
      candidates.push({
        itemId:Number(row.itemId) || null,
        itemName:String(row.itemName || 'item'),
        countryCode:travel.countryCode,
        countryName:travel.countryName,
        arrivalAt:travel.arrivalAt,
        source:source.providerId,
        quantity:Number(source.quantity),
        cost,
        marketPrice,
        profit,
        roi,
        createdAt:now
      });
    }
    candidates.sort((left,right) => right.roi - left.roi || right.profit - left.profit || right.quantity - left.quantity);
    return candidates[0] || null;
  }

  async function refresh(force = false) {
    if (refreshing) return refreshing;
    refreshing = (async () => {
      const now = Date.now();
      const [currentRuntime, storedSettings, currentWatches, travel] = await Promise.all([runtime(), settings(), watches(), currentTravelContext(now)]);
      const landingDue = storedSettings.landingRecommendationEnabled && travel
        && now >= travel.arrivalAt - LANDING_LEAD_MS
        && now <= travel.arrivalAt + LANDING_ALERT_GRACE_MS
        && Number(currentRuntime.landingCheckedArrivalAt || 0) !== Number(travel.arrivalAt);
      if (!force && !landingDue && Number(currentRuntime.fetchedAt) + CACHE_MS > now) return publicStatus(false);
      if (!force && !landingDue && Number(currentRuntime.activeUntil) <= now && !currentWatches.length) return publicStatus(false);

      const currentSettings = await detectTravelDefault(currentRuntime, storedSettings);
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
      if (landingDue) {
        try {
          const prices = await ensureMarketPrices(currentRuntime, now);
          currentRuntime.landingRecommendation = bestLandingRecommendation(mergedRows, prices, travel, now);
          currentRuntime.landingRecommendationError = '';
          currentRuntime.landingCheckedArrivalAt = travel.arrivalAt;
        } catch (error) {
          currentRuntime.landingRecommendation = null;
          currentRuntime.landingRecommendationError = SLINK.core.format.errorMessage(error);
          currentRuntime.landingCheckedArrivalAt = travel.arrivalAt;
        }
      }
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
    const next = normalizeSettings({ ...input, travelMethodExplicit:true });
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

  async function addItemWatches(itemNames = []) {
    const wanted = new Set((Array.isArray(itemNames) ? itemNames : []).map(value => String(value || '').trim().toLowerCase()).filter(Boolean));
    if (!wanted.size) throw new Error('Choose at least one museum item.');
    const [currentRuntime, currentWatches] = await Promise.all([runtime(), watches()]);
    const existing = new Set(currentWatches.map(entry => entry.key));
    let added = 0;
    for (const row of currentRuntime.rows || []) {
      if (!wanted.has(String(row.itemName || '').trim().toLowerCase()) || existing.has(row.key)) continue;
      currentWatches.push({
        key:row.key,
        countryCode:String(row.countryCode || ''),
        countryName:String(row.countryName || ''),
        itemId:Number(row.itemId) || null,
        itemName:String(row.itemName || '')
      });
      existing.add(row.key);
      added += 1;
    }
    await SLINK.core.storage.set(KEYS.watches, currentWatches);
    return { ...(await publicStatus(false)), added, matched:existing.size };
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
    const alerts = [];
    const byKey = new Map((currentRuntime.rows || []).map(row => [row.key, row]));
    if (currentSettings.alertsEnabled) alerts.push(...currentWatches.flatMap(watch => {
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
    }));
    const recommendation = currentRuntime.landingRecommendation;
    if (currentSettings.landingRecommendationEnabled && recommendation
      && Number(recommendation.arrivalAt) - LANDING_LEAD_MS <= now
      && now <= Number(recommendation.arrivalAt) + LANDING_ALERT_GRACE_MS) {
      const id = 'abroad:landing:' + Number(recommendation.arrivalAt) + ':' + (recommendation.itemId || recommendation.itemName);
      if (Number(snoozes?.[id] || 0) <= now) {
        const roi = Math.round(Number(recommendation.roi || 0) * 100);
        alerts.push({
          id,
          title:'Buy ' + recommendation.itemName,
          detail:'Best current return in ' + recommendation.countryName + ': +' + roi + '% ROI · buy for $' + Number(recommendation.cost).toLocaleString() + ' · market value $' + Number(recommendation.marketPrice).toLocaleString() + ' · ' + Number(recommendation.quantity).toLocaleString() + ' reported available.',
          tone:'urgent',
          links:[['Travel','https://www.torn.com/index.php']],
          shareText:'Abroad Stocks | Buy ' + recommendation.itemName + ' in ' + recommendation.countryName + ' | +' + roi + '% ROI | $' + Number(recommendation.cost).toLocaleString() + ' → $' + Number(recommendation.marketPrice).toLocaleString()
        });
      }
    }
    return alerts;
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
      landingRecommendation:currentRuntime.landingRecommendation || null,
      landingRecommendationError:String(currentRuntime.landingRecommendationError || ''),
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
    'abroadStocks.watch.addItems':payload => addItemWatches(payload?.itemNames),
    'abroadStocks.alert.snooze':payload => snoozeAlert(payload)
  });

  SLINK.define('services', 'abroadStocks', Object.freeze({
    ALARM,
    activeAlerts,
    addItemWatches,
    ensureAlarm,
    publicStatus,
    refresh,
    routes,
    snoozeAlert,
    touchActivity
  }));
})(globalThis);
