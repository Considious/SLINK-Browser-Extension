(function installAbroadStocksCore(global) {
  'use strict';

  const SLINK = global.SLINK_EXTENSION;
  if (!SLINK) throw new Error('SLINK runtime must load before Abroad Stocks.');

  const PROVIDERS = Object.freeze({
    yata:Object.freeze({ id:'yata', label:'YATA', url:'https://yata.yt/api/v1/travel/export/' }),
    prometheus:Object.freeze({ id:'prometheus', label:'Prometheus', url:'https://prombot.co.uk:8443/api/travel' }),
    tornIntel:Object.freeze({ id:'tornIntel', label:'Torn Intel', url:'https://torn-intel.com/api/v1/foreign-stock/travel-table' }),
    droqs:Object.freeze({ id:'droqs', label:'DroqsDB', url:'https://droqsdb.com/api/public/v1/export', enrichment:true })
  });

  const COUNTRIES = Object.freeze([
    ['arg','Argentina',158], ['can','Canada',39], ['cay','Cayman Islands',33],
    ['chi','China',229], ['haw','Hawaii',127], ['jap','Japan',213],
    ['mex','Mexico',24], ['sou','South Africa',282], ['swi','Switzerland',175],
    ['uae','UAE',271], ['uni','United Kingdom',159]
  ].map(([code,name,minutes]) => Object.freeze({ code, name, minutes })));

  const TRAVEL_MULTIPLIERS = Object.freeze({ standard:1, airstrip:0.7, private:0.5, business:0.3 });
  const countryByCode = new Map(COUNTRIES.map(country => [country.code, country]));
  const countryByName = new Map(COUNTRIES.map(country => [key(country.name), country]));

  function key(value) {
    return String(value ?? '').trim().replace(/\s+/g, ' ').toLocaleLowerCase();
  }

  function finite(value) {
    if (value === null || value === undefined || value === '') return null;
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
  }

  function timestamp(value, fallback = 0) {
    if (value === null || value === undefined || value === '') return Math.max(0, Number(fallback) || 0);
    if (typeof value === 'string' && !/^\d+(?:\.\d+)?$/.test(value.trim())) {
      const parsed = Date.parse(value);
      return Number.isFinite(parsed) ? parsed : Math.max(0, Number(fallback) || 0);
    }
    const number = finite(value);
    if (number === null || number <= 0) return Math.max(0, Number(fallback) || 0);
    return number < 10_000_000_000 ? Math.round(number * 1000) : Math.round(number);
  }

  function countryRecord(value) {
    const normalized = key(value);
    if (!normalized) return null;
    const compact = normalized.replace(/[^a-z]/g, '');
    return countryByCode.get(compact.slice(0, 3))
      || countryByName.get(normalized)
      || COUNTRIES.find(country => key(country.name).startsWith(normalized) || normalized.startsWith(key(country.name)))
      || null;
  }

  function rows(value) {
    if (Array.isArray(value)) return value;
    if (value && typeof value === 'object') return Object.values(value);
    return [];
  }

  function sourceCountries(payload) {
    const stocks = payload?.stocks || payload?.data?.stocks || payload?.result?.stocks;
    if (stocks && typeof stocks === 'object' && !Array.isArray(stocks)) {
      return Object.entries(stocks).map(([country, record]) => ({ country, ...(record || {}) }));
    }
    for (const candidate of [payload?.countries, payload?.data?.countries, payload?.result?.countries, payload?.data]) {
      if (Array.isArray(candidate)) return candidate;
    }
    return [];
  }

  function itemTimestamp(item, names, fallback = 0) {
    for (const name of names) {
      if (item?.[name] !== undefined && item?.[name] !== null) {
        const direct = timestamp(item[name]);
        if (direct) return direct;
      }
    }
    return timestamp(fallback);
  }

  function normalizeProvider(providerId, payload, fetchedAt = Date.now()) {
    const provider = PROVIDERS[providerId];
    if (!provider) throw new Error('Unknown abroad-stock provider.');
    const normalized = [];
    for (const countryInput of sourceCountries(payload || {})) {
      const country = countryRecord(countryInput?.country || countryInput?.code || countryInput?.iata || countryInput?.yataCode || countryInput?.name);
      if (!country) continue;
      const updatedAt = timestamp(
        countryInput?.update ?? countryInput?.updatedAt ?? countryInput?.lastUpdated ?? countryInput?.timestamp,
        payload?.timestamp ?? payload?.generatedAt ?? fetchedAt
      );
      const itemRows = rows(countryInput?.stocks || countryInput?.items || countryInput?.inventory || countryInput?.data);
      for (const item of itemRows) {
        const name = String(item?.name || item?.itemName || item?.item || '').trim();
        const id = Math.max(0, Math.trunc(finite(item?.id ?? item?.itemId ?? item?.item_id) || 0));
        if (!id && !name) continue;
        const quantity = finite(item?.quantity ?? item?.stock ?? item?.current ?? item?.amount);
        const cost = finite(item?.cost ?? item?.buyPrice ?? item?.price ?? item?.foreignPrice);
        let nextRestockAt = itemTimestamp(item, ['nextRestock','next_restock','nextRestockAt','estimatedRestockAt','restockAt']);
        if (!nextRestockAt && finite(item?.estimatedRestockMinutes) !== null) nextRestockAt = fetchedAt + Number(item.estimatedRestockMinutes) * 60_000;
        normalized.push({
          provider:providerId,
          countryCode:country.code,
          countryName:country.name,
          itemId:id || null,
          itemName:name || ('Item ' + id),
          quantity:quantity === null ? null : Math.max(0, Math.trunc(quantity)),
          cost:cost === null ? null : Math.max(0, Math.round(cost)),
          updatedAt,
          lastRestockAt:itemTimestamp(item, ['lastRestock','last_restock','lastRestockAt','previousRestockAt']),
          nextRestockAt,
          predictionSource:nextRestockAt ? provider.label : ''
        });
      }
    }
    return normalized;
  }

  function itemKey(row) {
    return String(row.countryCode) + ':' + (row.itemId || key(row.itemName));
  }

  function median(values) {
    const sorted = values.filter(Number.isFinite).sort((a,b) => a-b);
    if (!sorted.length) return 0;
    const middle = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[middle] : Math.round((sorted[middle - 1] + sorted[middle]) / 2);
  }

  function historyPrediction(historyEntry) {
    const events = [...new Set(rows(historyEntry?.restocks).map(Number).filter(value => Number.isFinite(value) && value > 0))].sort((a,b) => a-b);
    if (!events.length) return { lastRestockAt:0, nextRestockAt:0, samples:0 };
    const intervals = events.slice(1).map((value,index) => value - events[index]).filter(value => value >= 10 * 60_000 && value <= 14 * 24 * 60 * 60_000);
    const interval = median(intervals.slice(-6));
    return {
      lastRestockAt:events.at(-1),
      nextRestockAt:interval ? events.at(-1) + interval : 0,
      samples:intervals.length
    };
  }

  function mergeSnapshots(snapshots = {}, history = {}) {
    const merged = new Map();
    for (const [providerId, providerRows] of Object.entries(snapshots || {})) {
      if (!PROVIDERS[providerId]) continue;
      for (const source of rows(providerRows)) {
        const mapKey = itemKey(source);
        const current = merged.get(mapKey) || {
          key:mapKey,
          countryCode:source.countryCode,
          countryName:source.countryName,
          itemId:source.itemId,
          itemName:source.itemName,
          sources:{},
          lastRestockAt:0,
          nextRestockAt:0,
          predictionSource:'',
          predictionSamples:0
        };
        current.sources[providerId] = {
          quantity:source.quantity,
          cost:source.cost,
          updatedAt:source.updatedAt
        };
        if (Number(source.lastRestockAt) > Number(current.lastRestockAt)) current.lastRestockAt = Number(source.lastRestockAt);
        if (Number(source.nextRestockAt) > Date.now() && (!current.nextRestockAt || Number(source.nextRestockAt) < current.nextRestockAt)) {
          current.nextRestockAt = Number(source.nextRestockAt);
          current.predictionSource = source.predictionSource || PROVIDERS[providerId].label;
        }
        merged.set(mapKey, current);
      }
    }
    for (const row of merged.values()) {
      const prediction = historyPrediction(history[row.key]);
      if (prediction.lastRestockAt > row.lastRestockAt) row.lastRestockAt = prediction.lastRestockAt;
      if (!row.nextRestockAt && prediction.samples >= 2 && prediction.nextRestockAt > Date.now()) {
        row.nextRestockAt = prediction.nextRestockAt;
        row.predictionSource = 'SLINK observed history';
        row.predictionSamples = prediction.samples;
      }
    }
    return [...merged.values()].sort((left,right) => left.countryName.localeCompare(right.countryName) || left.itemName.localeCompare(right.itemName));
  }

  function travelMinutes(countryCode, method = 'private', bufferMinutes = 0) {
    const country = countryByCode.get(String(countryCode || '').toLowerCase());
    if (!country) return null;
    const multiplier = TRAVEL_MULTIPLIERS[method] ?? TRAVEL_MULTIPLIERS.private;
    return Math.ceil(country.minutes * multiplier) + Math.max(0, Number(bufferMinutes) || 0);
  }

  function departureAt(row, settings = {}) {
    const next = Number(row?.nextRestockAt) || 0;
    const minutes = travelMinutes(row?.countryCode, settings.travelMethod, settings.arrivalBufferMinutes);
    return next && minutes !== null ? next - minutes * 60_000 : 0;
  }

  function formatTct(value) {
    const time = Number(value);
    if (!time) return '';
    return new Intl.DateTimeFormat('en-GB', {
      timeZone:'UTC', hour:'2-digit', minute:'2-digit', second:'2-digit', hour12:false
    }).format(new Date(time)) + ' TCT';
  }

  SLINK.define('core', 'abroadStocks', Object.freeze({
    COUNTRIES,
    PROVIDERS,
    TRAVEL_MULTIPLIERS,
    countryRecord,
    departureAt,
    formatTct,
    historyPrediction,
    itemKey,
    mergeSnapshots,
    normalizeProvider,
    timestamp,
    travelMinutes
  }));
})(globalThis);
