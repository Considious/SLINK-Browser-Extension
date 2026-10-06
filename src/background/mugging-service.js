(function installMuggingService(global) {
  'use strict';

  const SLINK = global.SLINK_EXTENSION;
  const BASE_URL = 'https://slinkmuggingworker.richard-johnson554.workers.dev';
  const SETTINGS_KEY = 'mugging.settings.v1';
  const CACHE_KEY = 'mugging.cache.v1';
  const REQUIRED_SCOPE = 'slink.mugging';
  const ACTIVITY_KEY = 'mugging.activity.v1';
  const CONTRIBUTION_KEY = 'mugging.contribution.v1';
  const PENDING_KEY = 'mugging.contribution.pending.v1';
  const CLIENT_KEY = 'mugging.clientId.v1';
  const OWN_STATS_KEY = 'mugging.ownBattleStats.v1';
  const ALARM = 'slink.mugging.contributor';
  const INACTIVE_AFTER_MS = 5 * 60_000;
  const ACTIVE_BUDGET = 10;
  const INACTIVE_BUDGET = 5;
  const OWN_STATS_TTL_MS = 6 * 60 * 60_000;
  const ASSIGNMENT_REFRESH_MS = 5 * 60_000;
  let refreshing = null;
  let contributing = null;

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

  async function ownBattleStats(force = false) {
    const cached = await SLINK.core.storage.get(OWN_STATS_KEY, null);
    if (!force && Number(cached?.total) > 0 && Date.now() - Number(cached?.checkedAt || 0) < OWN_STATS_TTL_MS) return Number(cached.total);
    const key = await tornKey();
    if (!key) throw new Error('Save your Torn API key under API and feature access first.');
    await SLINK.core.tornApiLimiter.reserve({ wait:true, script:'SLINK Mugging', priority:'high', endpoint:'/v2/user/battlestats' });
    const response = await SLINK.core.http.requestJson(
      'tornApi',
      'https://api.torn.com/v2/user/battlestats?comment=SLINK%20Mugging%20rough%20assignment',
      { headers:{ Authorization:`ApiKey ${key}` }, cache:'no-store' }
    );
    if (response?.error) throw new Error(response.error?.message || response.error?.error || 'Torn rejected the battle-stat request.');
    const total = battleStatsTotal(response);
    await SLINK.core.storage.set(OWN_STATS_KEY, { total, checkedAt:Date.now() });
    return total;
  }

  async function cachedOwnBattleStats() {
    const cached = await SLINK.core.storage.get(OWN_STATS_KEY, null);
    return Number(cached?.total) > 0 ? Number(cached.total) : 0;
  }

  function contributionMode(lastActiveAt, now = Date.now()) {
    return Number(lastActiveAt) > 0 && now - Number(lastActiveAt) <= INACTIVE_AFTER_MS ? 'active' : 'inactive';
  }

  function contributionBudget(mode) { return mode === 'active' ? ACTIVE_BUDGET : INACTIVE_BUDGET; }

  async function touchActivity() {
    const activity = { lastActiveAt:Date.now() };
    await SLINK.core.storage.set(ACTIVITY_KEY, activity);
    return { ...activity, mode:'active', apiBudgetPerMinute:ACTIVE_BUDGET };
  }

  async function clientId() {
    let value = String(await SLINK.core.storage.get(CLIENT_KEY, '') || '').trim();
    if (!value) {
      value = global.crypto?.randomUUID?.() || `extension-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      await SLINK.core.storage.set(CLIENT_KEY, value);
    }
    return value;
  }

  async function requestTasks(session, mode, limit) {
    return SLINK.core.http.requestJson('muggingWorker', `${BASE_URL}/api/contributor/tasks`, {
      method:'POST',
      headers:{ Authorization:`Bearer ${session.token}`, 'Content-Type':'application/json' },
      cache:'no-store',
      body:JSON.stringify({ client_id:await clientId(), active:mode === 'active', limit })
    });
  }

  async function queueObservations(rows) {
    if (!rows.length) return;
    const current = await SLINK.core.storage.get(PENDING_KEY, []);
    const byPlayer = new Map((Array.isArray(current) ? current : []).map(row => [Number(row.playerId), row]));
    for (const row of rows) byPlayer.set(Number(row.playerId), row);
    await SLINK.core.storage.set(PENDING_KEY, [...byPlayer.values()]
      .sort((left, right) => Number(right.observedAt) - Number(left.observedAt)).slice(0, 500));
  }

  async function maybeRefreshActiveAssignments(now) {
    const cache = normalizeCache(await SLINK.core.storage.get(CACHE_KEY, {}));
    if (now - cache.updatedAt < ASSIGNMENT_REFRESH_MS) return false;
    const total = await cachedOwnBattleStats();
    if (!(total > 0)) return false;
    await refresh({ background:true, userBattleStats:total, touch:false });
    return true;
  }

  async function runContribution() {
    if (contributing) return contributing;
    contributing = (async () => {
      const now = Date.now();
      const settings = await SLINK.core.storage.get(SETTINGS_KEY, {});
      if (settings?.enabled !== true) {
        const disabled = { at:now, enabled:false, mode:'disabled', fetched:0, skipped:0, errors:0 };
        await SLINK.core.storage.set(CONTRIBUTION_KEY, disabled);
        return disabled;
      }
      const session = await SLINK.services.permissionAccess.ensureSession(false, REQUIRED_SCOPE);
      if (!SLINK.core.permissions.hasScope(session, REQUIRED_SCOPE)) throw new Error('Your SLINK account does not have slink.mugging permission.');
      const activity = await SLINK.core.storage.get(ACTIVITY_KEY, {});
      const mode = contributionMode(activity?.lastActiveAt, now);
      const budget = contributionBudget(mode);
      const response = await requestTasks(session, mode, Math.min(40, budget * 4));
      let fetched = 0, skipped = 0, errors = 0;
      const observations = [];
      for (const task of (Array.isArray(response?.tasks) ? response.tasks : [])) {
        if (fetched >= budget) break;
        try {
          const result = await SLINK.services.playerIntelligence.refresh({
            playerId:task.player_id,
            maxAgeMs:mode === 'active' ? 5 * 60_000 : 15 * 60_000,
            priority:mode === 'active' ? 'normal' : 'low',
            wait:false
          });
          if (!result?.fetched) { skipped++; continue; }
          fetched++;
          observations.push({ playerId:Number(task.player_id), observedAt:Number(result.record?.observedAt) || Date.now(), record:result.record, mode, pendingSync:true });
        } catch (error) {
          errors++;
          if (error?.code === 'SLINK_TORN_API_LIMIT') break;
        }
      }
      await queueObservations(observations);
      let assignmentsRefreshed = false;
      if (mode === 'active') {
        try { assignmentsRefreshed = await maybeRefreshActiveAssignments(now); } catch {}
      }
      const pending = await SLINK.core.storage.get(PENDING_KEY, []);
      const status = {
        at:Date.now(), enabled:true, mode, apiBudgetPerMinute:budget,
        tasksOffered:Array.isArray(response?.tasks) ? response.tasks.length : 0,
        fetched, skipped, errors, assignmentsRefreshed,
        pendingSync:Array.isArray(pending) ? pending.length : 0
      };
      await SLINK.core.storage.set(CONTRIBUTION_KEY, status);
      return status;
    })();
    try { return await contributing; }
    finally { contributing = null; }
  }

  async function ensureAlarm() {
    if (!await chrome.alarms.get(ALARM)) await chrome.alarms.create(ALARM, { delayInMinutes:1, periodInMinutes:1 });
  }

  function normalizeCache(value = {}) {
    return {
      updatedAt:Math.max(0, Number(value.updatedAt ?? value.generated_at) || 0),
      estimateKind:String((value.estimateKind ?? value.estimate_kind) || 'rough'),
      estimateSource:String((value.estimateSource ?? value.estimate_source) || 'cached battle-stat estimate'),
      userBattleStats:Math.max(0, Number(value.userBattleStats ?? value.user_battle_stats) || 0),
      pool:{
        total:Math.max(0, Number(value.pool?.total) || 0),
        estimable:Math.max(0, Number(value.pool?.estimable) || 0),
        eligible:Math.max(0, Number(value.pool?.eligible) || 0)
      },
      targets:(Array.isArray(value.targets) ? value.targets : []).map(target => ({
        id:Math.max(0, Math.trunc(Number(target?.id ?? target?.playerId) || 0)),
        name:String(target?.name || '').trim(),
        companyName:String((target?.companyName ?? target?.company_name) || ''),
        companyType:String((target?.companyType ?? target?.company_type) || ''),
        companyRating:Math.max(0, Number(target?.companyRating ?? target?.company_rating) || 0),
        position:String(target?.position || ''),
        status:target?.status && typeof target.status === 'object' ? target.status : null,
        fairFight:Number.isFinite(Number(target?.fairFight ?? target?.fair_fight)) ? Number(target?.fairFight ?? target?.fair_fight) : null,
        roughFairFight:Number.isFinite(Number(target?.roughFairFight ?? target?.rough_fair_fight)) ? Number(target?.roughFairFight ?? target?.rough_fair_fight) : null,
        battleStatsEstimate:Number.isFinite(Number(target?.battleStatsEstimate ?? target?.battle_stats_estimate)) ? Number(target?.battleStatsEstimate ?? target?.battle_stats_estimate) : null,
        battleStatsCheckedAt:Math.max(0, Number(target?.battleStatsCheckedAt ?? target?.battle_stats_checked_at) || 0),
        estimateKind:String((target?.estimateKind ?? target?.estimate_kind) || 'rough'),
        estimateSource:String((target?.estimateSource ?? target?.estimate_source) || 'cached'),
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
      if (input.touch !== false) await touchActivity();
      const suppliedStats = Number(input.userBattleStats) || 0;
      const userBattleStats = suppliedStats > 0 ? suppliedStats : await ownBattleStats(input.forceBattleStats === true);
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
      return { ...cache, contribution:await SLINK.core.storage.get(CONTRIBUTION_KEY, { enabled:false, mode:'disabled', fetched:0, skipped:0, errors:0, pendingSync:0 }) };
    })();
    try {
      return await refreshing;
    } finally {
      refreshing = null;
    }
  }

  async function status() {
    return {
      ...normalizeCache(await SLINK.core.storage.get(CACHE_KEY, {})),
      contribution:await SLINK.core.storage.get(CONTRIBUTION_KEY, { enabled:false, mode:'disabled', fetched:0, skipped:0, errors:0, pendingSync:0 })
    };
  }

  const routes = Object.freeze({
    'mugging.activity.touch':touchActivity,
    'mugging.assignments.refresh':refresh,
    'mugging.contribution.run':runContribution,
    'mugging.status':status
  });

  SLINK.define('services', 'mugging', Object.freeze({
    ACTIVE_BUDGET, ALARM, BASE_URL, INACTIVE_AFTER_MS, INACTIVE_BUDGET,
    battleStatsTotal, contributionBudget, contributionMode, ensureAlarm,
    normalizeCache, refresh, routes, runContribution, status, touchActivity
  }));
})(globalThis);
