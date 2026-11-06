(function installTornApiLimiter(global) {
  'use strict';

  const SLINK = global.SLINK_EXTENSION;
  if (!SLINK) throw new Error('SLINK runtime must load before the Torn API limiter.');

  const LEDGER_KEY = 'core.tornApiLedger.v1';
  const SHARED_LEDGER_KEY = 'considious:torn-api-ledger:v1';
  const SHARED_LOCK_NAME = 'considious-torn-api-limiter-v1';
  const WINDOW_MS = 60_000;
  const DEFAULT_LIMIT = 60;
  const CONTRIBUTION_CEILING = 40;
  const INTERACTIVE_RESERVE = 10;
  let queue = Promise.resolve();

  function eventId(prefix = 'extension') {
    return `${prefix}:${global.crypto?.randomUUID?.() || `${Date.now()}:${Math.random().toString(36).slice(2)}`}`;
  }

  function stableEventId(event, prefix = 'shared') {
    const source = [event.at, event.script, event.priority, event.method, event.endpoint, event.tabId].join('|');
    let hash = 2166136261;
    for (let index = 0; index < source.length; index += 1) {
      hash ^= source.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return `${prefix}:${event.at}:${(hash >>> 0).toString(36)}`;
  }

  function normalizeEvent(value) {
    if (Number.isFinite(Number(value))) {
      const at = Number(value);
      return { at, id:`legacy:${at}`, script:'SLINK Extension', priority:'normal', method:'GET', endpoint:'unknown', tabId:'' };
    }
    if (!value || typeof value !== 'object' || !Number.isFinite(Number(value.at))) return null;
    const at = Number(value.at);
    const normalized = {
      at,
      id:'',
      script:String(value.script || 'External Torn script').slice(0, 80),
      priority:String(value.priority || 'normal').slice(0, 24),
      method:String(value.method || 'GET').slice(0, 12),
      endpoint:String(value.endpoint || 'unknown').slice(0, 180),
      tabId:String(value.tabId || '').slice(0, 100)
    };
    normalized.id = String(value.id || stableEventId(normalized)).slice(0, 160);
    return normalized;
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

  // Reserve forecast foreground demand, not a fixed contribution allowance.
  async function foregroundDemand() {
    const [settings,activity,session] = await Promise.all([
      SLINK.core.storage.get('market.settings.v1',{}),
      SLINK.core.storage.get('market.activity.v1',{}),
      SLINK.core.storage.get('access.session.v1',null)
    ]);
    const now=Date.now(),valid=Boolean(session?.token&&Number(session.expiresAt)>now);
    const scopes=valid&&Array.isArray(session.scopes)?session.scopes:[];
    const alerts=scopes.some(s=>s==='admin.*'||s==='slink.adhd.*'||s==='slink.adhd.alerts')?5:0;
    const marketAllowed=valid&&(SLINK.core.adhd?.marketWatchLimit?.(session)>0);
    const active=Number(activity?.lastActiveAt)>0&&now-Number(activity.lastActiveAt)<=5*60_000;
    const market=marketAllowed&&active&&settings.enabled!==false&&settings.listedItemsEnabled!==false
      ? (settings.watches||[]).filter(w=>w.enabled!==false&&Number(w.maxPrice)>0&&(w.marketType==='points'||w.marketEnabled!==false)).length*2 : 0;
    return {market,alerts};
  }
  function protectedCapacity(ledger,demand={},priority='normal') {
    const count=p=>ledger.events.filter(e=>e.priority===p||(p==='market'&&/^\/v2\/market(?:\/|\?|$)/.test(e.endpoint))).length;
    const market=Math.max(0,Number(demand.market||0)-count('market'));
    const alerts=Math.max(0,Number(demand.alerts||0)-count('alerts'));
    return {market,alerts,reserved:priority==='alerts'?0:priority==='market'?alerts:market+alerts};
  }

  function contributionCapacityFromLedger(value, options = {}) {
    const ledger = normalizeLedger(value, Number(options.now) || Date.now());
    const limit = Math.min(DEFAULT_LIMIT, Math.max(1, Number(options.limit) || DEFAULT_LIMIT));
    const ceiling = Math.max(0, Number(options.ceiling) || CONTRIBUTION_CEILING);
    const interactiveReserve = Math.max(0, Number(options.interactiveReserve) || INTERACTIVE_RESERVE);
    const contributionCount = ledger.events.filter(event => event.priority === 'contribution').length;
    const foreground=protectedCapacity(ledger,options.demand);
    const totalHeadroom = Math.max(0, limit - interactiveReserve - foreground.reserved - ledger.events.length);
    const contributionHeadroom = Math.max(0, ceiling - contributionCount);
    return Object.freeze({
      available:Math.min(totalHeadroom, contributionHeadroom),
      count:ledger.events.length,
      contributionCount,
      limit,
      ceiling,
      interactiveReserve,
      cooldownUntil:ledger.cooldownUntil,
      foregroundReserved:foreground.reserved
    });
  }

  async function getContributionCapacity(options = {}) {
    return contributionCapacityFromLedger(await storedLedger(), {...options,demand:await foregroundDemand()});
  }

  async function reserve(options = {}) {
    const wait=options.wait!==false,priority=String(options.priority||'normal');
    while(true) {
      const result=await serialize(async()=>{
        const now=Date.now(),ledger=await storedLedger(now),demand=await foregroundDemand();
        const protectedSlots=protectedCapacity(ledger,demand,priority);
        const limit=Math.min(Math.max(1,Number(options.limit)||DEFAULT_LIMIT),Math.max(0,DEFAULT_LIMIT-protectedSlots.reserved));
        if(ledger.cooldownUntil<=now&&ledger.events.length<limit){
          ledger.events.push({at:now,id:eventId('slink-extension'),script:String(options.script||'SLINK Extension').slice(0,80),priority,method:String(options.method||'GET').slice(0,12),endpoint:String(options.endpoint||'unknown').slice(0,180),tabId:'extension'});
          await saveLedger(ledger);return {reservedAt:now,count:ledger.events.length,limit};
        }
        return {retryAfterMs:Math.max(50,Math.max(ledger.events[0]?.at+WINDOW_MS+25||now+250,ledger.cooldownUntil)-now),count:ledger.events.length,limit};
      });
      if(result.reservedAt)return Object.freeze(result);
      if(!wait){const error=new Error('Waiting for shared Torn API capacity; alerts and Market Watch have priority.');Object.assign(error,{code:'SLINK_TORN_API_LIMIT',retryAfterMs:result.retryAfterMs,usage:result.count,limit:result.limit});throw error;}
      // Never hold the reservation queue while sleeping: alerts can pass a waiting low-priority caller.
      await new Promise(resolve=>setTimeout(resolve,Math.min(5000,result.retryAfterMs)));
    }
  }

  async function reserveContribution(options = {}) {
    while(true){
      const result=await serialize(async()=>{
        const now=Date.now(),ledger=await storedLedger(now);
        const capacity=contributionCapacityFromLedger(ledger,{...options,now,demand:await foregroundDemand()});
        if(ledger.cooldownUntil<=now&&capacity.available>0){
          ledger.events.push({at:now,id:eventId('slink-extension'),script:String(options.script||'SLINK Shared Contribution').slice(0,80),priority:'contribution',method:String(options.method||'GET').slice(0,12),endpoint:String(options.endpoint||'unknown').slice(0,180),tabId:'extension'});
          await saveLedger(ledger);return {reservedAt:now,count:ledger.events.length,limit:capacity.limit,contributionCount:capacity.contributionCount+1,contributionCeiling:capacity.ceiling,interactiveReserve:capacity.interactiveReserve};
        }
        return {retryAfterMs:Math.max(50,Math.max(ledger.events[0]?.at+WINDOW_MS+25||now+250,ledger.cooldownUntil)-now),usage:ledger.events.length,limit:capacity.limit,contributionUsage:capacity.contributionCount,contributionCeiling:capacity.ceiling};
      });
      if(result.reservedAt)return Object.freeze(result);
      if(options.wait!==true){const error=new Error('No excess Torn API capacity is available after alerts, Market Watch and interactive work.');Object.assign(error,result,{code:'SLINK_TORN_API_LIMIT'});throw error;}
      await new Promise(resolve=>setTimeout(resolve,Math.min(5000,result.retryAfterMs)));
    }
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
    CONTRIBUTION_CEILING, DEFAULT_LIMIT, INTERACTIVE_RESERVE, SHARED_LEDGER_KEY, SHARED_LOCK_NAME, WINDOW_MS,
    protectedCapacity, foregroundDemand, contributionCapacityFromLedger, getContributionCapacity, getUsage, mergeLedgers, normalizeLedger, prune, reserve, reserveContribution, syncShared
  }));
})(globalThis);
