(function installTornApiLimiter(global) {
  'use strict';

  const SLINK = global.SLINK_EXTENSION;
  if (!SLINK) throw new Error('SLINK runtime must load before the Torn API limiter.');

  const LEDGER_KEY = 'core.tornApiLedger.v1';
  const SHARED_LEDGER_KEY = 'considious:torn-api-ledger:v1';
  const SHARED_LOCK_NAME = 'considious-torn-api-limiter-v1';
  const WINDOW_MS = 60_000;
  const DEFAULT_LIMIT = 60;
  let queue = Promise.resolve();

  function eventId(prefix = 'extension') {
    return `${prefix}:${global.crypto?.randomUUID?.() || `${Date.now()}:${Math.random().toString(36).slice(2)}`}`;
  }

  function normalizeEvent(value, index = 0) {
    if (Number.isFinite(Number(value))) {
      const at = Number(value);
      return { at, id:`legacy:${at}:${index}`, script:'SLINK Extension', priority:'normal', method:'GET', endpoint:'unknown', tabId:'' };
    }
    if (!value || typeof value !== 'object' || !Number.isFinite(Number(value.at))) return null;
    const at = Number(value.at);
    return {
      at,
      id:String(value.id || `shared:${at}:${index}`).slice(0, 160),
      script:String(value.script || 'External Torn script').slice(0, 80),
      priority:String(value.priority || 'normal').slice(0, 24),
      method:String(value.method || 'GET').slice(0, 12),
      endpoint:String(value.endpoint || 'unknown').slice(0, 180),
      tabId:String(value.tabId || '').slice(0, 100)
    };
  }

  function normalizeLedger(value, now = Date.now()) {
    const source = Array.isArray(value) ? { events:value } : value && typeof value === 'object' ? value : {};
    const cutoff = now - WINDOW_MS;
    const seen = new Set();
    const events = (Array.isArray(source.events) ? source.events : [])
      .map(normalizeEvent)
      .filter(event => event && event.at > cutoff && event.at <= now + 5_000)
      .filter(event => !seen.has(event.id) && seen.add(event.id))
      .sort((a, b) => a.at - b.at);
    const cooldownUntil = Number(source.cooldownUntil) > now ? Math.min(Number(source.cooldownUntil), now + 5 * 60_000) : 0;
    return { events, cooldownUntil };
  }

  function prune(value, now = Date.now()) {
    return normalizeLedger(value, now).events;
  }

  function mergeLedgers(left, right, now = Date.now()) {
    const first = normalizeLedger(left, now);
    const second = normalizeLedger(right, now);
    return normalizeLedger({ events:[...first.events, ...second.events], cooldownUntil:Math.max(first.cooldownUntil, second.cooldownUntil) }, now);
  }

  function serialize(task) {
    const result = queue.then(task, task);
    queue = result.catch(() => undefined);
    return result;
  }

  async function storedLedger(now = Date.now()) {
    return normalizeLedger(await SLINK.core.storage.get(LEDGER_KEY, { events:[], cooldownUntil:0 }), now);
  }

  async function saveLedger(ledger) {
    const normalized = normalizeLedger(ledger);
    await SLINK.core.storage.set(LEDGER_KEY, normalized);
    return normalized;
  }

  function usageFromLedger(ledger, limit) {
    const normalizedLimit = Math.max(1, Number(limit) || DEFAULT_LIMIT);
    const byScript = {};
    const byEndpoint = {};
    for (const event of ledger.events) {
      byScript[event.script] = (byScript[event.script] || 0) + 1;
      byEndpoint[event.endpoint] = (byEndpoint[event.endpoint] || 0) + 1;
    }
    return { count:ledger.events.length, limit:normalizedLimit, remaining:Math.max(0, normalizedLimit - ledger.events.length), cooldownUntil:ledger.cooldownUntil, byScript, byEndpoint };
  }

  async function getUsage(limit = DEFAULT_LIMIT) {
    return usageFromLedger(await storedLedger(), limit);
  }

  async function reserve(options = {}) {
    return serialize(async () => {
      const limit = Math.max(1, Number(options.limit) || DEFAULT_LIMIT);
      const wait = options.wait !== false;
      while (true) {
        const now = Date.now();
        const ledger = await storedLedger(now);
        if (ledger.cooldownUntil <= now && ledger.events.length < limit) {
          ledger.events.push({
            at:now,
            id:eventId('slink-extension'),
            script:String(options.script || 'SLINK Extension').slice(0, 80),
            priority:String(options.priority || 'normal').slice(0, 24),
            method:String(options.method || 'GET').slice(0, 12),
            endpoint:String(options.endpoint || 'unknown').slice(0, 180),
            tabId:'extension'
          });
          await saveLedger(ledger);
          return Object.freeze({ reservedAt:now, count:ledger.events.length, limit });
        }
        if (!wait) {
          const error = new Error('The shared Torn API limit is currently full.');
          error.code = 'SLINK_TORN_API_LIMIT';
          throw error;
        }
        const nextEvent = ledger.events[0]?.at + WINDOW_MS + 25 || now + 250;
        const delay = Math.max(50, Math.min(5_000, Math.max(nextEvent, ledger.cooldownUntil || 0) - now));
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    });
  }

  async function syncShared(input = {}) {
    return serialize(async () => {
      const now = Date.now();
      const merged = mergeLedgers(await storedLedger(now), input?.ledger, now);
      await saveLedger(merged);
      return { ledger:merged, usage:usageFromLedger(merged, DEFAULT_LIMIT), sharedLedgerKey:SHARED_LEDGER_KEY, sharedLockName:SHARED_LOCK_NAME };
    });
  }

  SLINK.define('core', 'tornApiLimiter', Object.freeze({
    DEFAULT_LIMIT, SHARED_LEDGER_KEY, SHARED_LOCK_NAME, WINDOW_MS,
    getUsage, mergeLedgers, normalizeLedger, prune, reserve, syncShared
  }));
})(globalThis);
