(function installMuggingService(global) {
  'use strict';

  const SLINK = global.SLINK_EXTENSION;
  const BASE_URL = 'https://slinkmuggingworker.richard-johnson554.workers.dev';
  const SETTINGS_KEY = 'mugging.settings.v1';
  const CACHE_KEY = 'mugging.cache.v1';
  const REQUIRED_SCOPE = 'slink.mugging';
  let refreshing = null;

  function finiteStat(value) {
    const candidate = value && typeof value === 'object'
      ? value.value ?? value.total ?? value.amount
      : value;
    const number = Number(candidate);
    return Number.isFinite(number) && number >= 0 ? number : null;
  }

  function battleStatsTotal(payload) {
    const source = payload?.battlestats ?? payload?.battle_stats ?? payload?.stats ?? payload ?? {};
    const values = ['strength', 'defense', 'speed', 'dexterity'].map(key => finiteStat(source[key]));
    if (values.some(value => value === null)) throw new Error('Torn returned incomplete battle stats for rough Fair Fight assignment.');
    const total = values.reduce((sum, value) => sum + value, 0);
    if (!(total > 0)) throw new Error('Your Torn battle-stat total is unavailable.');
    return total;
  }

  async function tornKey() {
    const [access, leveling, war] = await Promise.all([
      SLINK.core.storage.get('access.settings.v1', {}),
      SLINK.core.storage.get('leveling.settings.v1', {}),
      SLINK.core.storage.get('war.settings.v1', {})
    ]);
    return String(access?.tornKey || leveling?.tornKey || war?.tornKey || '').trim();
  }

  async function ownBattleStats() {
    const key = await tornKey();
    if (!key) throw new Error('Save your Torn API key under API and feature access first.');
    await SLINK.core.tornApiLimiter.reserve({ wait:true, priority:'high' });
    const response = await SLINK.core.http.requestJson(
      'tornApi',
      'https://api.torn.com/v2/user/battlestats?comment=SLINK%20Mugging%20rough%20assignment',
      { headers:{ Authorization:`ApiKey ${key}` }, cache:'no-store' }
    );
    if (response?.error) throw new Error(response.error?.message || response.error?.error || 'Torn rejected the battle-stat request.');
    return battleStatsTotal(response);
  }

  function normalizeCache(value = {}) {
    return {
      updatedAt:Math.max(0, Number(value.updatedAt ?? value.generated_at) || 0),
      estimateKind:String(value.estimateKind ?? value.estimate_kind || 'rough'),
      estimateSource:String(value.estimateSource ?? value.estimate_source || 'cached battle-stat estimate'),
      userBattleStats:Math.max(0, Number(value.userBattleStats ?? value.user_battle_stats) || 0),
      pool:{
        total:Math.max(0, Number(value.pool?.total) || 0),
        estimable:Math.max(0, Number(value.pool?.estimable) || 0),
        eligible:Math.max(0, Number(value.pool?.eligible) || 0)
      },
      targets:(Array.isArray(value.targets) ? value.targets : []).map(target => ({
        id:Math.max(0, Math.trunc(Number(target?.id ?? target?.playerId) || 0)),
        name:String(target?.name || '').trim(),
        companyName:String(target?.companyName ?? target?.company_name || ''),
        companyType:String(target?.companyType ?? target?.company_type || ''),
        companyRating:Math.max(0, Number(target?.companyRating ?? target?.company_rating) || 0),
        position:String(target?.position || ''),
        status:target?.status && typeof target.status === 'object' ? target.status : null,
        fairFight:Number.isFinite(Number(target?.fairFight ?? target?.fair_fight)) ? Number(target?.fairFight ?? target?.fair_fight) : null,
        roughFairFight:Number.isFinite(Number(target?.roughFairFight ?? target?.rough_fair_fight)) ? Number(target?.roughFairFight ?? target?.rough_fair_fight) : null,
        battleStatsEstimate:Number.isFinite(Number(target?.battleStatsEstimate ?? target?.battle_stats_estimate)) ? Number(target?.battleStatsEstimate ?? target?.battle_stats_estimate) : null,
        battleStatsCheckedAt:Math.max(0, Number(target?.battleStatsCheckedAt ?? target?.battle_stats_checked_at) || 0),
        estimateKind:String(target?.estimateKind ?? target?.estimate_kind || 'rough'),
        estimateSource:String(target?.estimateSource ?? target?.estimate_source || 'cached'),
        confidence:String(target?.confidence || ''),
        priorityMultiplier:Math.max(0, Number(target?.priorityMultiplier ?? target?.priority_multiplier) || 0),
        mugCount7d:Math.max(0, Number(target?.mugCount7d ?? target?.mug_count_7d) || 0),
        mugCount30d:Math.max(0, Number(target?.mugCount30d ?? target?.mug_count_30d) || 0),
        mugValueAverage:Math.max(0, Number(target?.mugValueAverage ?? target?.mug_value_average) || 0)
      })).filter(target => target.id > 0)
    };
  }

  async function refresh(input = {}) {
    if (refreshing) return refreshing;
    refreshing = (async () => {
      const session = await SLINK.services.permissionAccess.ensureSession(false, REQUIRED_SCOPE);
      if (!SLINK.core.permissions.hasScope(session, REQUIRED_SCOPE)) {
        throw new Error('Your SLINK account does not have slink.mugging permission.');
      }
      const settings = {
        ...(await SLINK.core.storage.get(SETTINGS_KEY, {})),
        ...(input && typeof input === 'object' ? input : {})
      };
      if (settings.enabled !== true) throw new Error('Enable Mugging on this device before requesting assignments.');
      const userBattleStats = await ownBattleStats();
      const response = await SLINK.core.http.requestJson('muggingWorker', `${BASE_URL}/api/assignments/rough`, {
        method:'POST',
        headers:{
          Authorization:`Bearer ${session.token}`,
          'Content-Type':'application/json'
        },
        cache:'no-store',
        body:JSON.stringify({
          user_battle_stats:userBattleStats,
          min_fair_fight:Number(settings.minFairFight) || 1,
          max_fair_fight:Number(settings.maxFairFight) || 3,
          limit:Math.max(1, Math.min(100, Math.trunc(Number(settings.limit) || 50)))
        })
      });
      const cache = normalizeCache(response);
      await SLINK.core.storage.set(CACHE_KEY, cache);
      return cache;
    })();
    try {
      return await refreshing;
    } finally {
      refreshing = null;
    }
  }

  async function status() {
    return normalizeCache(await SLINK.core.storage.get(CACHE_KEY, {}));
  }

  const routes = Object.freeze({
    'mugging.assignments.refresh':refresh,
    'mugging.status':status
  });

  SLINK.define('services', 'mugging', Object.freeze({
    BASE_URL,
    battleStatsTotal,
    normalizeCache,
    refresh,
    routes,
    status
  }));
})(globalThis);
