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

  // Torn Wiki Travel, without book, verified 2026-10-26. Exact displayed times avoid multiplier rounding errors.
  // https://wiki.torn.com/wiki/Travel — Private is WLT; Business Class is the faster ticket option.
  const COUNTRIES = Object.freeze([
    ["arg","Argentina",158,111,79,47],
    ["can","Canada",39,27,19,12],
    ["cay","Cayman Islands",33,23,17,10],
    ["chi","China",229,160,114,69],
    ["haw","Hawaii",127,89,63,38],
    ["jap","Japan",213,149,107,64],
    ["mex","Mexico",24,17,12,7],
    ["sou","South Africa",282,197,141,85],
    ["swi","Switzerland",166,116,83,50],
    ["uae","UAE",257,180,128,77],
    ["uni","United Kingdom",151,106,75,45]
  ].map(([code,name,minutes,airstrip,privateMinutes,business]) => Object.freeze({
    code,name,minutes,travelTimes:Object.freeze({standard:minutes,airstrip,private:privateMinutes,business})
  })));
  const TRAVEL_MULTIPLIERS = Object.freeze({ standard:1, airstrip:0.7, business:0.3, private:0.5 });
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

  function objectRecord(value) {
    return Boolean(value && typeof value === 'object' && !Array.isArray(value));
  }

  function rows(value) {
    if (Array.isArray(value)) return value;
    if (objectRecord(value)) return Object.values(value);
    return [];
  }

  function providerCountryRecord(value, fallback = '') {
    const input = objectRecord(value) ? value : {};
    const nested = objectRecord(input.country) ? input.country : {};
    const codeCandidates = [
      input.countryCode, input.country_code, input.yataCode, input.yata_code,
      input.code, input.iata, nested.countryCode, nested.country_code,
      nested.yataCode, nested.yata_code, nested.code, nested.iata, fallback
    ];
    const nameCandidates = [
      input.countryName, input.country_name,
      nested.name, nested.countryName, nested.country_name,
      input.stocks || input.items || input.inventory || input.data ? input.name : '',
      typeof input.country === 'string' ? input.country : ''
    ];
    for (const candidate of [...codeCandidates, ...nameCandidates]) {
      const known = countryRecord(candidate);
      if (known) return known;
    }
    const rawName = nameCandidates.map(value => String(value ?? '').trim()).find(Boolean) || '';
    const rawCode = codeCandidates.map(value => String(value ?? '').trim()).find(value => /^[a-z0-9_-]{2,12}$/i.test(value)) || '';
    const compactCode = key(rawCode).replace(/[^a-z0-9]/g, '');
    const derivedCode = key(rawName).replace(/[^a-z0-9]/g, '').slice(0, 3);
    const code = compactCode || derivedCode;
    if (!code) return null;
    return {
      code,
      name:rawName || rawCode.toUpperCase(),
      minutes:null
    };
  }

  function hasItemContainer(value) {
    return objectRecord(value) && ['stocks','items','inventory','data'].some(name => Array.isArray(value[name]) || objectRecord(value[name]));
  }

  function keyedCountryRows(value) {
    if (!objectRecord(value)) return [];
    const wrapperKeys = new Set(['stocks','items','inventory','countries','data','result','timestamp','generatedAt','generated_at','updatedAt','updated_at']);
    return Object.entries(value)
      .filter(([country, record]) => !wrapperKeys.has(country) && (Array.isArray(record) || hasItemContainer(record)))
      .map(([country, record]) => Array.isArray(record)
        ? { country, stocks:record }
        : { country, ...record });
  }

  function itemRows(value) {
    if (Array.isArray(value)) return value;
    if (!objectRecord(value)) return [];
    return Object.entries(value).map(([fallbackId, item]) => {
      if (!objectRecord(item)) return { id:fallbackId, quantity:item };
      if (item.id !== undefined || item.itemId !== undefined || item.item_id !== undefined) return item;
      return /^\d+$/.test(fallbackId) ? { id:Number(fallbackId), ...item } : item;
    });
  }

  function flatCountryRows(value) {
    if (!Array.isArray(value)) return [];
    const grouped = new Map();
    for (const item of value) {
      const country = providerCountryRecord(item);
      if (!country) continue;
      const current = grouped.get(country.code) || { country:country.code, name:country.name, stocks:[] };
      current.stocks.push(item);
      grouped.set(country.code, current);
    }
    return [...grouped.values()];
  }

  function sourceCountries(payload) {
    const stocks = payload?.stocks || payload?.data?.stocks || payload?.result?.stocks;
    const stockRows = keyedCountryRows(stocks);
    if (stockRows.length) return stockRows;

    const countryCandidates = [
      payload?.countries, payload?.data?.countries, payload?.result?.countries,
      payload?.data, payload?.result
    ];
    for (const candidate of countryCandidates) {
      if (Array.isArray(candidate) && candidate.some(hasItemContainer)) return candidate;
      const keyed = keyedCountryRows(candidate);
      if (keyed.length) return keyed;
    }

    const flatCandidates = [
      payload?.items, payload?.inventory, payload?.data?.items, payload?.data?.inventory,
      payload?.result?.items, payload?.result?.inventory,
      ...countryCandidates.filter(Array.isArray)
    ];
    for (const candidate of flatCandidates) {
      const grouped = flatCountryRows(candidate);
      if (grouped.length) return grouped;
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
      const country = providerCountryRecord(countryInput, countryInput?.country);
      if (!country) continue;
      const updatedAt = timestamp(
        countryInput?.update ?? countryInput?.updatedAt ?? countryInput?.updated_at
          ?? countryInput?.lastUpdated ?? countryInput?.last_updated ?? countryInput?.timestamp,
        payload?.timestamp ?? payload?.generatedAt ?? payload?.generated_at ?? fetchedAt
      );
      const source = countryInput?.stocks ?? countryInput?.items ?? countryInput?.inventory ?? countryInput?.data;
      for (const item of itemRows(source)) {
        const nestedItem = objectRecord(item?.item) ? item.item : {};
        const name = String(
          item?.name ?? item?.itemName ?? item?.item_name ?? nestedItem?.name
            ?? (typeof item?.item === 'string' ? item.item : '')
        ).trim();
        const id = Math.max(0, Math.trunc(finite(
          item?.id ?? item?.itemId ?? item?.item_id ?? nestedItem?.id ?? nestedItem?.itemId
        ) || 0));
        if (!id && !name) continue;
        const quantity = finite(
          item?.quantity ?? item?.stock ?? item?.current ?? item?.currentStock
            ?? item?.current_stock ?? item?.amount ?? item?.available
        );
        const cost = finite(
          item?.cost ?? item?.buyPrice ?? item?.buy_price ?? item?.price
            ?? item?.foreignPrice ?? item?.foreign_price
        );
        let nextRestockAt = itemTimestamp(item, [
          'nextRestock','next_restock','nextRestockAt','next_restock_at',
          'estimatedRestockAt','estimated_restock_at','estimatedRestockTime',
          'restockAt','restock_at'
        ]);
        const estimatedMinutes = finite(item?.estimatedRestockMinutes ?? item?.estimated_restock_minutes ?? item?.restockMinutes);
        if (!nextRestockAt && estimatedMinutes !== null && estimatedMinutes >= 0) {
          nextRestockAt = timestamp(payload?.generatedAt ?? payload?.generated_at, fetchedAt) + estimatedMinutes * 60_000;
        }
        normalized.push({
          provider:providerId,
          countryCode:country.code,
          countryName:country.name,
          itemId:id || null,
          itemName:name || ('Item ' + id),
          quantity:quantity === null ? null : Math.max(0, Math.trunc(quantity)),
          cost:cost === null ? null : Math.max(0, Math.round(cost)),
          updatedAt:itemTimestamp(item, [
            'stockUpdatedAt','stock_updated_at','updatedAt','updated_at','lastUpdated','last_updated','timestamp'
          ], updatedAt),
          lastRestockAt:itemTimestamp(item, [
            'lastRestock','last_restock','lastRestockAt','last_restock_at','previousRestockAt','previous_restock_at'
          ]),
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

  function travelMinutes(countryCode, method = 'standard', bufferMinutes = 0) {
    const country = countryByCode.get(String(countryCode || '').toLowerCase());
    if (!country) return null;
    return (country.travelTimes[method] ?? country.travelTimes.standard) + Math.max(0, Number(bufferMinutes) || 0);
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
