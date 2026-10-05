(function installPlayerIntelligenceService(global) {
  'use strict';

  const SLINK = global.SLINK_EXTENSION;
  const CORE = SLINK.core.playerIntelligence;
  const CACHE_KEY = 'playerIntelligence.cache.v1';
  const inFlight = new Map();
  let writeQueue = Promise.resolve();

  async function cacheMap() {
    const stored = await SLINK.core.storage.get(CACHE_KEY, {});
    return stored && typeof stored === 'object' && !Array.isArray(stored)
      ? stored
      : {};
  }

  async function observe(input = {}) {
    const playerId = CORE.validPlayerId(
      input.playerId ?? input.player_id ?? input.targetId ?? input.id
    );
    if (!playerId) throw new Error('A valid Torn player ID is required.');
    let record = null;
    writeQueue = writeQueue.then(async () => {
      const cache = await cacheMap();
      record = CORE.mergeRecord(cache[String(playerId)], {
        ...input,
        playerId
      });
      cache[String(playerId)] = record;
      await SLINK.core.storage.set(CACHE_KEY, cache);
    });
    await writeQueue;
    return record;
  }

  async function observeMany(values = []) {
    let updated = 0;
    let cache = {};
    writeQueue = writeQueue.then(async () => {
      cache = await cacheMap();
      for (const input of Array.isArray(values) ? values : []) {
        const playerId = CORE.validPlayerId(
          input?.playerId ?? input?.player_id ?? input?.targetId ?? input?.id
        );
        if (!playerId) continue;
        cache[String(playerId)] = CORE.mergeRecord(cache[String(playerId)], {
          ...input,
          playerId
        });
        updated += 1;
      }
      if (updated) await SLINK.core.storage.set(CACHE_KEY, cache);
    });
    await writeQueue;
    return { updated, cache };
  }

  async function get(input = {}) {
    const playerId = CORE.validPlayerId(
      input.playerId ?? input.player_id ?? input.targetId ?? input.id
    );
    if (!playerId) throw new Error('A valid Torn player ID is required.');
    const cache = await cacheMap();
    const record = cache[String(playerId)] || null;
    return {
      record:record
        ? { ...record, status:CORE.effectiveStatus(record) }
        : null,
      decision:CORE.requestDecision(record, input)
    };
  }

  async function tornKey() {
    const [bounties, leveling, war, access] = await Promise.all([
      SLINK.core.storage.get('bounties.settings.v1', {}),
      SLINK.core.storage.get('leveling.settings.v1', {}),
      SLINK.core.storage.get('war.settings.v1', {}),
      SLINK.core.storage.get('access.settings.v1', {})
    ]);
    return String(
      bounties?.tornKey || leveling?.tornKey || war?.tornKey ||
      access?.tornKey || ''
    ).trim();
  }

  async function refresh(input = {}) {
    const playerId = CORE.validPlayerId(
      input.playerId ?? input.player_id ?? input.targetId ?? input.id
    );
    if (!playerId) throw new Error('A valid Torn player ID is required.');
    const cache = await cacheMap();
    const current = cache[String(playerId)] || null;
    const decision = CORE.requestDecision(current, input);
    if (!decision.required) {
      return {
        record:current
          ? { ...current, status:CORE.effectiveStatus(current) }
          : null,
        fetched:false,
        reason:decision.reason,
        nextCheckAt:decision.nextCheckAt
      };
    }
    if (inFlight.has(playerId)) return inFlight.get(playerId);
    const pending = (async () => {
      const key = await tornKey();
      if (!key) throw new Error('Save a Torn API key before refreshing player intelligence.');
      const endpoint = `/v2/user/${playerId}/basic`;
      await SLINK.core.tornApiLimiter.reserve({
        wait:true,
        script:'SLINK Player Intelligence',
        priority:String(input.priority || 'normal'),
        endpoint
      });
      const response = await SLINK.core.http.requestJson(
        'tornApi',
        `https://api.torn.com${endpoint}`,
        {
          headers:{ Authorization:`ApiKey ${key}` },
          cache:'no-store'
        }
      );
      if (response?.error) {
        throw new Error(
          response.error.message || response.error.error ||
          'Torn player lookup failed.'
        );
      }
      const record = await observe(
        CORE.fromTornResponse(playerId, response, Date.now())
      );
      return {
        record:{ ...record, status:CORE.effectiveStatus(record) },
        fetched:true,
        reason:'api',
        nextCheckAt:CORE.requestDecision(record, input).nextCheckAt
      };
    })().finally(() => inFlight.delete(playerId));
    inFlight.set(playerId, pending);
    return pending;
  }

  SLINK.define('services', 'playerIntelligence', Object.freeze({
    CACHE_KEY,
    cacheMap,
    get,
    observe,
    observeMany,
    refresh,
    routes:Object.freeze({
      'playerIntelligence.get':get,
      'playerIntelligence.observe':observe,
      'playerIntelligence.refresh':refresh,
      'playerIntelligence.list':async () => ({ players:await cacheMap() })
    })
  }));
})(globalThis);
