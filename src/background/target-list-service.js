(function installTargetListService(global) {
  'use strict';

  const SLINK = global.SLINK_EXTENSION;
  const CORE = SLINK.core.targetList;
  const STORE_KEY = 'targetList.entries.v1';
  const POLLING_SETTINGS_KEY = 'targetList.polling.settings.v1';
  const POLLING_RUNTIME_KEY = 'targetList.polling.runtime.v1';
  const POLL_ALARM = 'slink.target-list.poll';
  const POLL_ALARM_MINUTES = 1;
  const DEFAULT_INTERVAL_MINUTES = 10;
  const MIN_INTERVAL_MINUTES = 1;
  const MAX_INTERVAL_MINUTES = 1440;
  const STAKEOUT_RUNTIME_KEY = 'targetList.stakeout.runtime.v1';
  const STAKEOUT_ALERTS_KEY = 'targetList.stakeout.alerts.v1';
  const STAKEOUT_ALERT_LIFETIME_MS = 24 * 60 * 60_000;
  const STAKEOUT_MAX_DUE_PER_TICK = 20;
  let writeQueue = Promise.resolve();
  let pollInFlight = null;
  let stakeoutInFlight = null;

  async function entryMap() {
    const stored = await SLINK.core.storage.get(STORE_KEY, {});
    return stored && typeof stored === 'object' && !Array.isArray(stored) ? stored : {};
  }

  async function saveMap(entries) {
    await SLINK.core.storage.set(STORE_KEY, entries);
    return entries;
  }

  async function mutate(task) {
    let result;
    const run = async () => {
      const entries = await entryMap();
      result = await task(entries);
      await saveMap(entries);
    };
    const pending = writeQueue.then(run, run);
    writeQueue = pending.catch(() => undefined);
    await pending;
    return result;
  }

  function normalizePollingSettings(value = {}) {
    return {
      enabled:value.enabled === true,
      intervalMinutes:Math.max(
        MIN_INTERVAL_MINUTES,
        Math.min(MAX_INTERVAL_MINUTES, Math.trunc(Number(value.intervalMinutes) || DEFAULT_INTERVAL_MINUTES))
      ),
      mugOnly:value.mugOnly === true,
      revision:Math.max(0, Number(value.revision) || 0)
    };
  }

  async function pollingSettings() {
    return normalizePollingSettings(
      await SLINK.core.storage.get(POLLING_SETTINGS_KEY, {})
    );
  }

  function normalizePollingRuntime(value = {}) {
    const schedule = value.schedule && typeof value.schedule === 'object' && !Array.isArray(value.schedule)
      ? value.schedule
      : {};
    return {
      revision:Math.max(0, Number(value.revision) || 0),
      schedule,
      lastRunAt:Math.max(0, Number(value.lastRunAt) || 0),
      lastPlanned:Math.max(0, Math.trunc(Number(value.lastPlanned) || 0)),
      lastProcessed:Math.max(0, Math.trunc(Number(value.lastProcessed) || 0)),
      lastApiFetched:Math.max(0, Math.trunc(Number(value.lastApiFetched) || 0)),
      lastSkipped:Math.max(0, Math.trunc(Number(value.lastSkipped) || 0)),
      lastError:String(value.lastError || '').slice(0, 500)
    };
  }

  async function pollingRuntime() {
    return normalizePollingRuntime(
      await SLINK.core.storage.get(POLLING_RUNTIME_KEY, {})
    );
  }

  function eligibleTargets(entries, settings) {
    return Object.values(entries)
      .map(target => CORE.normalizeTarget(target))
      .filter(target => !target.stakeout)
      .filter(target => !settings.mugOnly || target.tags.some(tag => String(tag).toLowerCase() === 'mug'))
      .sort((left, right) => left.playerId - right.playerId);
  }

  function seedSchedule(runtime, targets, settings, now = Date.now()) {
    const targetIds = new Set(targets.map(target => String(target.playerId)));
    for (const id of Object.keys(runtime.schedule)) {
      if (!targetIds.has(id)) delete runtime.schedule[id];
    }
    if (runtime.revision !== settings.revision) {
      runtime.schedule = {};
      runtime.revision = settings.revision;
    }
    const intervalMs = settings.intervalMinutes * 60_000;
    const spacingMs = targets.length ? intervalMs / targets.length : intervalMs;
    targets.forEach((target, index) => {
      const id = String(target.playerId);
      const due = Number(runtime.schedule[id]);
      if (!Number.isFinite(due) || due <= 0) {
        runtime.schedule[id] = Math.floor(now + index * spacingMs);
      }
    });
    return runtime;
  }

  async function pollingStatus(entries = null) {
    const [settings, runtime, storedEntries] = await Promise.all([
      pollingSettings(),
      pollingRuntime(),
      entries ? Promise.resolve(entries) : entryMap()
    ]);
    const eligible = eligibleTargets(storedEntries, settings);
    const dueValues = eligible
      .map(target => Number(runtime.schedule[String(target.playerId)]) || 0)
      .filter(value => value > 0);
    return {
      settings,
      runtime:{
        lastRunAt:runtime.lastRunAt,
        lastPlanned:runtime.lastPlanned,
        lastProcessed:runtime.lastProcessed,
        lastApiFetched:runtime.lastApiFetched,
        lastSkipped:runtime.lastSkipped,
        lastError:runtime.lastError,
        nextDueAt:dueValues.length ? Math.min(...dueValues) : 0
      },
      eligibleCount:eligible.length,
      estimatedChecksPerMinute:eligible.length
        ? Math.ceil(eligible.length / settings.intervalMinutes)
        : 0
    };
  }

  function normalizeStakeoutRuntime(value = {}) {
    return {
      schedule:value.schedule && typeof value.schedule === 'object' && !Array.isArray(value.schedule) ? value.schedule : {},
      observed:value.observed && typeof value.observed === 'object' && !Array.isArray(value.observed) ? value.observed : {},
      lastRunAt:Math.max(0, Number(value.lastRunAt) || 0),
      lastProcessed:Math.max(0, Math.trunc(Number(value.lastProcessed) || 0)),
      lastApiFetched:Math.max(0, Math.trunc(Number(value.lastApiFetched) || 0)),
      lastSkipped:Math.max(0, Math.trunc(Number(value.lastSkipped) || 0)),
      lastError:String(value.lastError || '').slice(0, 500)
    };
  }

  async function stakeoutRuntime() {
    return normalizeStakeoutRuntime(await SLINK.core.storage.get(STAKEOUT_RUNTIME_KEY, {}));
  }

  function stakeoutTargets(entries) {
    return Object.values(entries)
      .map(target => CORE.normalizeTarget(target))
      .filter(target => target.stakeout)
      .sort((left, right) =>
        left.stakeoutIntervalSeconds - right.stakeoutIntervalSeconds ||
        left.name.localeCompare(right.name)
      );
  }

  function normalizeAlertState(value = {}) {
    return {
      items:value.items && typeof value.items === 'object' && !Array.isArray(value.items) ? value.items : {},
      snoozedUntil:value.snoozedUntil && typeof value.snoozedUntil === 'object' && !Array.isArray(value.snoozedUntil) ? value.snoozedUntil : {}
    };
  }

  async function alertState() {
    return normalizeAlertState(await SLINK.core.storage.get(STAKEOUT_ALERTS_KEY, {}));
  }

  async function saveStakeoutAlerts(alerts = [], now = Date.now()) {
    if (!alerts.length) return 0;
    const state = await alertState();
    for (const alert of alerts) state.items[alert.id] = alert;
    for (const [id, alert] of Object.entries(state.items)) {
      if (Number(alert?.expiresAt) <= now) delete state.items[id];
    }
    await SLINK.core.storage.set(STAKEOUT_ALERTS_KEY, state);
    return alerts.length;
  }

  async function activeAlerts(now = Date.now()) {
    const state = await alertState();
    let changed = false;
    const alerts = [];
    for (const [id, alert] of Object.entries(state.items)) {
      if (Number(alert?.expiresAt) <= now) {
        delete state.items[id];
        changed = true;
        continue;
      }
      if (Number(state.snoozedUntil[id] || 0) > now) continue;
      alerts.push(alert);
    }
    if (changed) await SLINK.core.storage.set(STAKEOUT_ALERTS_KEY, state);
    return alerts.sort((left, right) => Number(right.createdAt) - Number(left.createdAt));
  }

  async function snoozeAlert(input = {}) {
    const id = String(input.id || '');
    if (!id.startsWith('stakeout:')) throw new Error('Unknown Stakeout alert.');
    const durationMs = Math.min(24 * 60 * 60_000, Math.max(60_000, Number(input.durationMs) || 5 * 60_000));
    const state = await alertState();
    state.snoozedUntil[id] = Date.now() + durationMs;
    await SLINK.core.storage.set(STAKEOUT_ALERTS_KEY, state);
    return { ok:true };
  }

  function stakeoutObservation(record = null, now = Date.now()) {
    if (!record) return null;
    const status = SLINK.core.playerIntelligence.effectiveStatus(record, now);
    return {
      state:String(status?.state || 'Unknown'),
      bountyCount:Math.max(0, Math.trunc(Number(record.bountyCount) || 0)),
      bountyTotal:Math.max(0, Number(record.bountyTotal) || 0),
      observedAt:Math.max(0, Number(record.observedAt || record.checkedAt) || now)
    };
  }

  function collectStakeoutChanges(target, runtime, record, now = Date.now()) {
    const id = String(target.playerId);
    const current = stakeoutObservation(record, now);
    if (!current) return [];
    const previous = runtime.observed[id] || null;
    runtime.observed[id] = current;
    if (!previous) return [];
    const profile = `https://www.torn.com/profiles.php?XID=${target.playerId}`;
    const attack = `https://www.torn.com/page.php?sid=attack&user2ID=${target.playerId}`;
    const links = [['Profile', profile], ['Attack', attack]];
    const alerts = [];
    if (previous.state !== current.state && current.state !== 'Unknown') {
      const attackable = current.state === 'Okay';
      const event = attackable ? 'attackable' : `state-${current.state.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
      alerts.push({
        id:`stakeout:${target.playerId}:${event}`,
        title:attackable ? `${target.name} is attackable` : `${target.name} changed status`,
        detail:`${previous.state || 'Unknown'} → ${current.state}`,
        tone:attackable ? 'ready' : current.state === 'Hospital' ? 'danger' : 'warning',
        links,
        shareText:`${target.name} [${target.playerId}] is ${current.state}. <a href="${profile}">Profile</a> · <a href="${attack}">Attack</a>`,
        createdAt:now,
        expiresAt:now + STAKEOUT_ALERT_LIFETIME_MS,
        source:'stakeout',
        playerId:target.playerId
      });
    }
    if (
      current.bountyCount > previous.bountyCount ||
      current.bountyTotal > previous.bountyTotal
    ) {
      alerts.push({
        id:`stakeout:${target.playerId}:bounty`,
        title:`Bounty appeared on ${target.name}`,
        detail:`${current.bountyCount} active · ${current.bountyTotal.toLocaleString()}`,
        tone:'ready',
        links,
        shareText:`${target.name} [${target.playerId}] has ${current.bountyCount} active bounties worth ${current.bountyTotal.toLocaleString()}. <a href="${profile}">Profile</a> · <a href="${attack}">Attack</a>`,
        createdAt:now,
        expiresAt:now + STAKEOUT_ALERT_LIFETIME_MS,
        source:'stakeout',
        playerId:target.playerId
      });
    }
    return alerts;
  }

  async function stakeoutStatus(entries = null) {
    const [storedEntries, runtime, alerts] = await Promise.all([
      entries ? Promise.resolve(entries) : entryMap(),
      stakeoutRuntime(),
      activeAlerts()
    ]);
    const targets = stakeoutTargets(storedEntries);
    const estimate = targets.reduce((total, target) => total + 60 / target.stakeoutIntervalSeconds, 0);
    return {
      targetCount:targets.length,
      estimatedChecksPerMinute:Number(estimate.toFixed(1)),
      activeAlerts:alerts,
      runtime:{
        lastRunAt:runtime.lastRunAt,
        lastProcessed:runtime.lastProcessed,
        lastApiFetched:runtime.lastApiFetched,
        lastSkipped:runtime.lastSkipped,
        lastError:runtime.lastError
      }
    };
  }

  async function runStakeouts(input = {}) {
    if (stakeoutInFlight) return stakeoutInFlight;
    stakeoutInFlight = (async () => {
      const now = Math.max(0, Number(input.now) || Date.now());
      const [entries, runtime, intelligence] = await Promise.all([
        entryMap(), stakeoutRuntime(), SLINK.services.playerIntelligence.cacheMap()
      ]);
      const targets = stakeoutTargets(entries);
      const ids = new Set(targets.map(target => String(target.playerId)));
      for (const id of Object.keys(runtime.schedule)) if (!ids.has(id)) delete runtime.schedule[id];
      for (const id of Object.keys(runtime.observed)) if (!ids.has(id)) delete runtime.observed[id];

      targets.forEach((target, index) => {
        const id = String(target.playerId);
        if (!Number.isFinite(Number(runtime.schedule[id])) || Number(runtime.schedule[id]) <= 0) {
          runtime.schedule[id] = now + Math.min(index * 1_000, target.stakeoutIntervalSeconds * 1_000);
        }
      });
      const due = targets
        .filter(target => Number(runtime.schedule[String(target.playerId)]) <= now)
        .sort((left, right) => Number(runtime.schedule[String(left.playerId)]) - Number(runtime.schedule[String(right.playerId)]))
        .slice(0, STAKEOUT_MAX_DUE_PER_TICK);
      let processed = 0;
      let apiFetched = 0;
      let skipped = 0;
      let lastError = '';
      const generated = [];

      for (const target of due) {
        const id = String(target.playerId);
        const intervalMs = target.stakeoutIntervalSeconds * 1_000;
        generated.push(...collectStakeoutChanges(target, runtime, intelligence[id] || null, now));
        try {
          const result = await SLINK.services.playerIntelligence.refresh({
            playerId:target.playerId,
            priority:'high',
            maxAgeMs:intervalMs,
            timerBufferMs:1_000
          });
          processed += 1;
          if (result.fetched) apiFetched += 1;
          else skipped += 1;
          generated.push(...collectStakeoutChanges(target, runtime, result.record, now));
          runtime.schedule[id] = result.reason === 'known-timer' || result.reason === 'fresh-cache'
            ? Math.max(now + 1_000, Number(result.nextCheckAt) || now + intervalMs)
            : now + intervalMs;
        } catch (error) {
          processed += 1;
          lastError = SLINK.core.format.errorMessage(error);
          runtime.schedule[id] = now + Math.max(10_000, intervalMs);
        }
      }

      runtime.lastRunAt = now;
      runtime.lastProcessed = processed;
      runtime.lastApiFetched = apiFetched;
      runtime.lastSkipped = skipped;
      runtime.lastError = lastError;
      await Promise.all([
        SLINK.core.storage.set(STAKEOUT_RUNTIME_KEY, runtime),
        saveStakeoutAlerts(generated, now)
      ]);
      if (generated.length && SLINK.services.audio?.flush) {
        void SLINK.services.audio.flush().catch(() => undefined);
      }
      return stakeoutStatus(entries);
    })().finally(() => { stakeoutInFlight = null; });
    return stakeoutInFlight;
  }

  async function status() {
    const [entries, intelligence] = await Promise.all([
      entryMap(),
      SLINK.services.playerIntelligence.cacheMap()
    ]);
    const targets = Object.values(entries).map(target => {
      const record = intelligence[String(target.playerId || target.id)] || null;
      return CORE.enrichTarget(
        target,
        record ? { ...record, status:SLINK.core.playerIntelligence.effectiveStatus(record) } : null
      );
    }).sort((a, b) =>
      Number(b.stakeout) - Number(a.stakeout) ||
      b.updatedAt - a.updatedAt ||
      a.name.localeCompare(b.name)
    );
    return {
      targets,
      count:targets.length,
      availableTags:[...CORE.DEFAULT_TAGS],
      storage:'local',
      polling:await pollingStatus(entries),
      stakeout:await stakeoutStatus(entries)
    };
  }

  async function add(input = {}) {
    const playerId = CORE.validPlayerId(
      input.playerId ?? input.player_id ?? input.targetId ?? input.id
    );
    if (!playerId) throw new Error('Enter a valid Torn player ID.');
    await mutate(entries => {
      entries[String(playerId)] = CORE.mergeTarget(entries[String(playerId)], {
        ...input,
        playerId,
        source:input.source || 'manual',
        sourceLabel:input.sourceLabel || (input.source === 'manual' || !input.source ? 'Manual' : input.source)
      });
      return entries[String(playerId)];
    });
    if (input.status && typeof input.status === 'object') {
      await SLINK.services.playerIntelligence.observe({
        ...input.status,
        playerId,
        name:input.name,
        source:input.status.source || input.source || 'target-list'
      });
    }
    return status();
  }

  async function update(input = {}) {
    const playerId = CORE.validPlayerId(
      input.playerId ?? input.player_id ?? input.targetId ?? input.id
    );
    if (!playerId) throw new Error('A valid Torn player ID is required.');
    await mutate(entries => {
      const existing = entries[String(playerId)];
      if (!existing) throw new Error('The saved target was not found.');
      entries[String(playerId)] = CORE.updateTarget(existing, { ...input, playerId });
      return entries[String(playerId)];
    });
    return status();
  }

  async function remove(input = {}) {
    const playerId = CORE.validPlayerId(
      input.playerId ?? input.player_id ?? input.targetId ?? input.id
    );
    if (!playerId) throw new Error('A valid Torn player ID is required.');
    await mutate(entries => {
      delete entries[String(playerId)];
      return true;
    });
    return status();
  }

  async function refresh(input = {}) {
    const playerId = CORE.validPlayerId(
      input.playerId ?? input.player_id ?? input.targetId ?? input.id
    );
    if (!playerId) throw new Error('A valid Torn player ID is required.');
    const entries = await entryMap();
    if (!entries[String(playerId)]) throw new Error('The saved target was not found.');
    const refreshResult = await SLINK.services.playerIntelligence.refresh({
      playerId,
      priority:'high',
      forceApi:input.forceApi === true
    });
    const current = await status();
    return { ...current, refresh:refreshResult };
  }

  async function ensureAlarm() {
    if (!global.chrome?.alarms) return false;
    if (!await chrome.alarms.get(POLL_ALARM)) {
      await chrome.alarms.create(POLL_ALARM, {
        delayInMinutes:POLL_ALARM_MINUTES,
        periodInMinutes:POLL_ALARM_MINUTES
      });
    }
    return true;
  }

  async function configurePolling(input = {}) {
    const previous = await pollingSettings();
    const next = normalizePollingSettings({ ...previous, ...input });
    const changed = previous.intervalMinutes !== next.intervalMinutes ||
      previous.mugOnly !== next.mugOnly ||
      previous.enabled !== next.enabled;
    next.revision = changed ? Date.now() : previous.revision;
    await SLINK.core.storage.set(POLLING_SETTINGS_KEY, next);
    if (changed) {
      await SLINK.core.storage.set(POLLING_RUNTIME_KEY, normalizePollingRuntime({
        revision:next.revision,
        schedule:{}
      }));
    }
    await ensureAlarm();
    return status();
  }

  async function runPolling(input = {}) {
    if (pollInFlight) return pollInFlight;
    pollInFlight = (async () => {
      const now = Math.max(0, Number(input.now) || Date.now());
      const [settings, entries, storedRuntime] = await Promise.all([
        pollingSettings(),
        entryMap(),
        pollingRuntime()
      ]);
      const runtime = seedSchedule(storedRuntime, eligibleTargets(entries, settings), settings, now);
      const targets = eligibleTargets(entries, settings);
      if (!settings.enabled || !targets.length) {
        runtime.lastRunAt = now;
        runtime.lastPlanned = 0;
        runtime.lastProcessed = 0;
        runtime.lastApiFetched = 0;
        runtime.lastSkipped = 0;
        runtime.lastError = '';
        await SLINK.core.storage.set(POLLING_RUNTIME_KEY, runtime);
        return pollingStatus(entries);
      }

      const intervalMs = settings.intervalMinutes * 60_000;
      const perMinute = Math.max(1, Math.ceil(targets.length / settings.intervalMinutes));
      const due = targets
        .filter(target => Number(runtime.schedule[String(target.playerId)]) <= now)
        .sort((left, right) =>
          Number(runtime.schedule[String(left.playerId)]) -
          Number(runtime.schedule[String(right.playerId)])
        )
        .slice(0, perMinute);
      let processed = 0;
      let apiFetched = 0;
      let skipped = 0;
      let lastError = '';

      for (const target of due) {
        const id = String(target.playerId);
        try {
          const result = await SLINK.services.playerIntelligence.refresh({
            playerId:target.playerId,
            priority:'low',
            maxAgeMs:intervalMs
          });
          processed += 1;
          if (result.fetched) apiFetched += 1;
          else skipped += 1;
          runtime.schedule[id] = result.reason === 'known-timer'
            ? Math.max(now + 30_000, Number(result.nextCheckAt) || now + intervalMs)
            : result.reason === 'fresh-cache'
              ? Math.max(now + 30_000, Number(result.nextCheckAt) || now + intervalMs)
              : now + intervalMs;
        } catch (error) {
          processed += 1;
          lastError = SLINK.core.format.errorMessage(error);
          runtime.schedule[id] = now + 60_000;
        }
      }

      runtime.lastRunAt = now;
      runtime.lastPlanned = due.length;
      runtime.lastProcessed = processed;
      runtime.lastApiFetched = apiFetched;
      runtime.lastSkipped = skipped;
      runtime.lastError = lastError;
      await SLINK.core.storage.set(POLLING_RUNTIME_KEY, runtime);
      return pollingStatus(entries);
    })().finally(() => { pollInFlight = null; });
    return pollInFlight;
  }

  SLINK.define('services', 'targetList', Object.freeze({
    STORE_KEY,
    POLLING_SETTINGS_KEY,
    POLLING_RUNTIME_KEY,
    POLL_ALARM,
    STAKEOUT_RUNTIME_KEY,
    STAKEOUT_ALERTS_KEY,
    activeAlerts,
    add,
    configurePolling,
    eligibleTargets,
    ensureAlarm,
    entryMap,
    pollingSettings,
    pollingStatus,
    runStakeouts,
    snoozeAlert,
    stakeoutStatus,
    stakeoutTargets,
    refresh,
    remove,
    runPolling,
    status,
    update,
    routes:Object.freeze({
      'targetList.status':status,
      'targetList.add':add,
      'targetList.update':update,
      'targetList.remove':remove,
      'targetList.refresh':refresh,
      'targetList.polling.configure':configurePolling,
      'targetList.polling.run':runPolling,
      'targetList.stakeout.run':runStakeouts,
      'targetList.stakeout.alerts':async () => ({ alerts:await activeAlerts() }),
      'targetList.stakeout.alert.snooze':snoozeAlert
    })
  }));
})(globalThis);
