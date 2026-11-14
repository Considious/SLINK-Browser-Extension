(function installPlayerIntelligenceService(global) {
  'use strict';

  const SLINK = global.SLINK_EXTENSION;
  const CORE = SLINK.core.playerIntelligence;
  const CACHE_KEY = 'playerIntelligence.cache.v1';
  const inFlight = new Map();
  let writeQueue = Promise.resolve();
  const databaseStore = () => SLINK.services.playerIntelligenceStore?.available()
    ? SLINK.services.playerIntelligenceStore : null;

  async function cacheMap() {
    if (databaseStore()) return databaseStore().all();
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
    const task = writeQueue.then(async () => {
      const store = databaseStore();
      const cache = store ? null : await cacheMap();
      record = CORE.mergeRecord(store ? await store.get(playerId) : cache[String(playerId)], {
        ...input,
        playerId
      });
      if (store) await store.putMany({ [String(playerId)]:record });
      else {
        cache[String(playerId)] = record;
        await SLINK.core.storage.set(CACHE_KEY, cache);
      }
    });
    writeQueue = task.catch(() => undefined);
    await task;
    return record;
  }

  async function observeMany(values = []) {
    let updated = 0;
    let cache = {};
    const task = writeQueue.then(async () => {
      cache = await cacheMap();
      const changed = {};
      for (const input of Array.isArray(values) ? values : []) {
        const playerId = CORE.validPlayerId(
          input?.playerId ?? input?.player_id ?? input?.targetId ?? input?.id
        );
        if (!playerId) continue;
        cache[String(playerId)] = CORE.mergeRecord(cache[String(playerId)], {
          ...input,
          playerId
        });
        changed[String(playerId)] = cache[String(playerId)];
        updated += 1;
      }
      if (updated) {
        if (databaseStore()) await databaseStore().putMany(changed);
        else await SLINK.core.storage.set(CACHE_KEY, cache);
      }
    });
    writeQueue = task.catch(() => undefined);
    await task;
    return { updated, cache };
  }

  async function get(input = {}) {
    const playerId = CORE.validPlayerId(
      input.playerId ?? input.player_id ?? input.targetId ?? input.id
    );
    if (!playerId) throw new Error('A valid Torn player ID is required.');
    const record = databaseStore() ? await databaseStore().get(playerId) : (await cacheMap())[String(playerId)] || null;
    return {
      record:record
        ? { ...record, status:CORE.effectiveStatus(record) }
        : null,
      decision:CORE.requestDecision(record, input)
    };
  }

  async function factionMemberIntel(input = {}, sender) {
    if (!sender?.tab?.url || !Array.isArray(input.ids) || input.ids.length > 200) return {};
    const page=new URL(sender.tab.url);
    if(page.origin!=='https://www.torn.com'||!(['/factions.php','/hospitalview.php','/jailview.php'].includes(page.pathname)||(
      page.pathname==='/page.php'&&(page.searchParams.get('sid')?.toLowerCase()==='userlist'||(page.searchParams.get('sid')==='list'&&['friends','enemies','targets'].includes(page.searchParams.get('type'))))
    )||(page.pathname==='/index.php'&&page.searchParams.get('page')==='people')))return {};
    const session=await SLINK.core.storage.get('access.session.v1',null);
    if (!session?.userId || !(session.expiresAt>Date.now())) return {};
    const providers=await SLINK.core.storage.get('shared.providers.v1',{});
    const own=Object.values(providers.personal||{}).filter(r=>Number(r.accountId)===Number(session.userId)&&r.source==='torn-v2-authenticated-battlestats').sort((a,b)=>b.statsAt-a.statsAt)[0];
    const context={observerId:session.userId,ownStatsAt:own?.statsAt||0};
    const ids=[...new Set(input.ids.map(CORE.validPlayerId).filter(Boolean))];
    return Object.fromEntries(await Promise.all(ids.map(async id=>{
      const {record}=await get({playerId:id});
      return [id,{ff:CORE.contextualFairFight(record,context),stats:Number(record?.battleStatsEstimate)>0?Number(record.battleStatsEstimate):null}];
    })));
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
    const current = databaseStore() ? await databaseStore().get(playerId) : (await cacheMap())[String(playerId)] || null;
    const decision = CORE.requestDecision(current, input);
    const comments = { mugging:'SLINK Mug Ext', leveling:'SLINK Lvl Ext', contributor:'SLINK Lvl Donor', polling:'SLINK Poll Ext', stakeout:'SLINK Stake Ext', target:'SLINK Tgt Ext' };
    const comment = Object.hasOwn(comments,input.owner) ? comments[input.owner] : 'SLINK Intel Ext';
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
    if (inFlight.has(playerId)) {
      const result=await inFlight.get(playerId);
      return result.reason==='inactive' ? result : {...result,fetched:false,reason:'in-flight-cache'};
    }
    const pending = (async () => {
      const key = input.apiKey || await tornKey();
      if (!key) throw new Error('Save a Torn API key before refreshing player intelligence.');
      const endpoint = `/v2/user/${playerId}/basic`;
      const reservation = input.contribution === true
        ? SLINK.core.tornApiLimiter.reserveContribution
        : SLINK.core.tornApiLimiter.reserve;
      await reservation({
        wait:input.contribution === true ? input.wait === true : input.wait !== false,
        script:comment,
        priority:input.contribution === true ? 'contribution' : String(input.priority || 'normal'),
        endpoint
      });
      if (input.active && !await input.active()) return {record:current,fetched:false,reason:'inactive'};
      const response = await SLINK.core.http.requestJson(
        'tornApi',
        `https://api.torn.com${endpoint}?comment=${encodeURIComponent(comment)}`,
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
      const observation=CORE.fromTornResponse(playerId,response,Date.now());
      if (observation.state==='Unknown') return {record:current,fetched:true,reason:'no-status'};
      const record = await observe(observation);
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
      'factionMembers.cachedIntel':factionMemberIntel,
      'playerIntelligence.get':get,
      'playerIntelligence.observe':observe,
      'playerIntelligence.refresh':input=>refresh({playerId:input?.playerId ?? input?.player_id ?? input?.targetId ?? input?.id, forceApi:input?.forceApi===true}),
      'playerIntelligence.list':async () => ({ players:await cacheMap() })
    })
  }));
})(globalThis);
