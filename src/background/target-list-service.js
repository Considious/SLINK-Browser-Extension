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
  let writeQueue = Promise.resolve();
  let pollInFlight = null;

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
    }).sort((a, b) => b.updatedAt - a.updatedAt || a.name.localeCompare(b.name));
    return {
      targets,
      count:targets.length,
      availableTags:[...CORE.DEFAULT_TAGS],
      storage:'local',
      polling:await pollingStatus(entries)
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
    add,
    configurePolling,
    eligibleTargets,
    ensureAlarm,
    entryMap,
    pollingSettings,
    pollingStatus,
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
      'targetList.polling.run':runPolling
    })
  }));
})(globalThis);
