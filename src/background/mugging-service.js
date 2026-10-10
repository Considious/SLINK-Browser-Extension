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
  const SYNC_KEY = 'mugging.contribution.sync.v1';
  const CLIENT_KEY = 'mugging.clientId.v1';
  const OWN_STATS_KEY = 'mugging.ownBattleStats.v1';
  const ALARM = 'slink.mugging.contributor';
  const INACTIVE_AFTER_MS = 5 * 60_000;
  const CONTRIBUTION_CEILING = 40;
  const INTERACTIVE_RESERVE = 10;
  const OWN_STATS_TTL_MS = 6 * 60 * 60_000;
  const ASSIGNMENT_REFRESH_MS = 5 * 60_000;
  const SYNC_INTERVAL_MS = 6 * 60 * 60_000;
  const SYNC_BATCH_SIZE = 100;
  const SYNC_MAX_BATCHES = 5;
  let refreshing = null;
  let contributing = null;
  let syncing = null;

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

  function contributionBudget() { return CONTRIBUTION_CEILING; }

  async function touchActivity() {
    const activity = { lastActiveAt:Date.now() };
    await SLINK.core.storage.set(ACTIVITY_KEY, activity);
    const capacity = await SLINK.core.tornApiLimiter.getContributionCapacity({
      ceiling:CONTRIBUTION_CEILING,
      interactiveReserve:INTERACTIVE_RESERVE
    });
    return { ...activity, mode:'active', apiBudgetPerMinute:capacity.available };
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

  function reportForObservation(row, client) {
    const record = row?.record && typeof row.record === 'object' ? row.record : {};
    const playerId = Math.max(0, Math.trunc(Number(row?.playerId ?? record.playerId ?? record.id) || 0));
    const observedAt = Math.max(0, Number(row?.observedAt ?? record.observedAt) || Date.now());
    return {
      report_id:`${client}:${playerId}:${Math.trunc(observedAt)}`,
      player_id:playerId,
      name:String(record.name || '').slice(0, 80),
      observed_at:observedAt,
      state:String(record.state ?? record.status?.state ?? '').slice(0, 40),
      description:String(record.description ?? record.status?.description ?? '').slice(0, 500),
      until:Math.max(0, Math.trunc(Number(record.until ?? record.status?.until) || 0)),
      level:Math.max(0, Number(record.level) || 0),
      bountyCount:Math.max(0, Math.trunc(Number(record.bountyCount) || 0)),
      bountyTotal:Math.max(0, Number(record.bountyTotal) || 0),
      battleStatsEstimate:Number.isFinite(Number(record.battleStatsEstimate)) ? Number(record.battleStatsEstimate) : null,
      fairFight:Number.isFinite(Number(record.fairFight)) ? Number(record.fairFight) : null
    };
  }

  async function syncPending(force = false) {
    if (syncing) return syncing;
    syncing = (async () => {
      const now = Date.now();
      const previous = await SLINK.core.storage.get(SYNC_KEY, {});
      if (!force && now - Number(previous?.lastAttemptAt || 0) < SYNC_INTERVAL_MS) return previous;
      const settings = await SLINK.core.storage.get(SETTINGS_KEY, {});
      if (settings?.enabled !== true) return previous;
      const session = await SLINK.services.permissionAccess.ensureSession(false, REQUIRED_SCOPE);
      if (!SLINK.core.permissions.hasScope(session, REQUIRED_SCOPE)) throw new Error('Your SLINK account does not have slink.mugging permission.');
      const client = await clientId();
      let accepted = 0;
      let batches = 0;
      try {
        for (; batches < SYNC_MAX_BATCHES; batches++) {
          const pending = await SLINK.core.storage.get(PENDING_KEY, []);
          const rows = (Array.isArray(pending) ? pending : []).slice(0, SYNC_BATCH_SIZE);
          if (!rows.length) break;
          const reports = rows.map(row => reportForObservation(row, client)).filter(report => report.player_id > 0);
          if (!reports.length) {
            await SLINK.core.storage.set(PENDING_KEY, []);
            break;
          }
          const response = await SLINK.core.http.requestJson('muggingWorker', `${BASE_URL}/api/contributor/reports`, {
            method:'POST',
            headers:{ Authorization:`Bearer ${session.token}`, 'Content-Type':'application/json' },
            cache:'no-store',
            body:JSON.stringify({ client_id:client, reports })
          });
          const acknowledged = new Set(Array.isArray(response?.acknowledged_report_ids) ? response.acknowledged_report_ids.map(String) : []);
          if (!acknowledged.size) throw new Error('The Mugging Worker did not acknowledge the contributor batch.');
          const latest = await SLINK.core.storage.get(PENDING_KEY, []);
          const remaining = (Array.isArray(latest) ? latest : []).filter(row => !acknowledged.has(reportForObservation(row, client).report_id));
          await SLINK.core.storage.set(PENDING_KEY, remaining);
          accepted += acknowledged.size;
          if (rows.length < SYNC_BATCH_SIZE) break;
        }
        const pending = await SLINK.core.storage.get(PENDING_KEY, []);
        const status = {
          lastAttemptAt:now,
          lastSuccessAt:Date.now(),
          accepted,
          batches,
          pendingSync:Array.isArray(pending) ? pending.length : 0,
          error:''
        };
        await SLINK.core.storage.set(SYNC_KEY, status);
        return status;
      } catch (error) {
        const pending = await SLINK.core.storage.get(PENDING_KEY, []);
        const status = {
          ...previous,
          lastAttemptAt:now,
          accepted:0,
          batches,
          pendingSync:Array.isArray(pending) ? pending.length : 0,
          error:error instanceof Error ? error.message : String(error)
        };
        await SLINK.core.storage.set(SYNC_KEY, status);
        return status;
      }
    })();
    try { return await syncing; }
    finally { syncing = null; }
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
      const capacity = await SLINK.core.tornApiLimiter.getContributionCapacity({
        ceiling:CONTRIBUTION_CEILING,
        interactiveReserve:INTERACTIVE_RESERVE
      });
      const response = capacity.available > 0
        ? await requestTasks(session, mode, Math.min(100, capacity.available * 4))
        : { tasks:[] };
      let fetched = 0, skipped = 0, errors = 0;
      const observations = [];
      for (const task of (Array.isArray(response?.tasks) ? response.tasks : [])) {
        if (fetched >= capacity.available) break;
        try {
          const result = await SLINK.services.playerIntelligence.refresh({
            playerId:task.player_id,
            maxAgeMs:15 * 60_000,
            priority:'contribution',
            contribution:true,
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
      const sync = await syncPending(false);
      const pending = await SLINK.core.storage.get(PENDING_KEY, []);
      const status = {
        at:Date.now(), enabled:true, mode, apiBudgetPerMinute:capacity.available,
        contributionCeiling:CONTRIBUTION_CEILING,
        interactiveReserve:INTERACTIVE_RESERVE,
        sharedUsageAtStart:capacity.count,
        tasksOffered:Array.isArray(response?.tasks) ? response.tasks.length : 0,
        fetched, skipped, errors, assignmentsRefreshed,
        pendingSync:Array.isArray(pending) ? pending.length : 0,
        lastSyncAt:Math.max(0, Number(sync?.lastSuccessAt) || 0),
        synced:Math.max(0, Number(sync?.accepted) || 0),
        syncError:String(sync?.error || '')
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
    const [contribution, sync, pending] = await Promise.all([
      SLINK.core.storage.get(CONTRIBUTION_KEY, { enabled:false, mode:'disabled', fetched:0, skipped:0, errors:0, pendingSync:0 }),
      SLINK.core.storage.get(SYNC_KEY, {}),
      SLINK.core.storage.get(PENDING_KEY, [])
    ]);
    return {
      ...normalizeCache(await SLINK.core.storage.get(CACHE_KEY, {})),
      contribution:{
        ...contribution,
        pendingSync:Array.isArray(pending) ? pending.length : 0,
        lastSyncAt:Math.max(0, Number(sync?.lastSuccessAt) || 0),
        synced:Math.max(0, Number(sync?.accepted) || 0),
        syncError:String(sync?.error || '')
      }
    };
  }

  const routes = Object.freeze({
    'mugging.activity.touch':touchActivity,
    'mugging.assignments.refresh':refresh,
    'mugging.contribution.run':runContribution,
    'mugging.contribution.sync':input => syncPending(input?.force === true),
    'mugging.status':status
  });

  SLINK.define('services', 'mugging', Object.freeze({
    ALARM, BASE_URL, CONTRIBUTION_CEILING, INACTIVE_AFTER_MS, INTERACTIVE_RESERVE,
    battleStatsTotal, contributionBudget, contributionMode, ensureAlarm,
    normalizeCache, refresh, reportForObservation, routes, runContribution, status, syncPending, touchActivity
  }));
})(globalThis);
