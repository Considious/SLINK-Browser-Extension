(function installTargetListService(global) {
  'use strict';

  const SLINK = global.SLINK_EXTENSION;
  const CORE = SLINK.core.targetList;
  const STORE_KEY = 'targetList.entries.v1';
  let writeQueue = Promise.resolve();

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
      storage:'local'
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

  SLINK.define('services', 'targetList', Object.freeze({
    STORE_KEY,
    add,
    entryMap,
    refresh,
    remove,
    status,
    update,
    routes:Object.freeze({
      'targetList.status':status,
      'targetList.add':add,
      'targetList.update':update,
      'targetList.remove':remove,
      'targetList.refresh':refresh
    })
  }));
})(globalThis);
