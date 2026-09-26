(function installBountiesService(global) {
  'use strict';

  const SLINK = global.SLINK_EXTENSION;
  const CORE = SLINK.core.bounties;
  const KEYS = Object.freeze({
    settings:'bounties.settings.v1',
    runtime:'bounties.runtime.v1',
    activity:'bounties.lastInteractionAt.v1',
    fairFight:'bounties.fairFightCache.v1',
    status:'bounties.statusCache.v1',
    budgets:'bounties.requestBudgets.v1'
  });
  const DISPLAY_LIMIT = 200;
  const PAGE_LIMIT = 100;
  const PAGES_PER_BATCH = 2;
  let scanPromise = null;
  let budgetQueue = Promise.resolve();

  function defaultRuntime() {
    return {
      targets:[],
      nextUrl:'',
      scannedRows:0,
      reportedTotal:0,
      completed:false,
      stoppedAtMinimum:false,
      scanning:false,
      snapshotTimestamp:0,
      cacheDelaySeconds:30,
      nextRefreshAt:0,
      lastBatchAt:0,
      lastError:'',
      cycleStatus:'Disabled',
      pagesFetched:0
    };
  }

  async function settings() {
    return CORE.normalizeSettings(await SLINK.core.storage.get(KEYS.settings, {}));
  }

  async function runtime() {
    return { ...defaultRuntime(), ...(await SLINK.core.storage.get(KEYS.runtime, {})) };
  }

  async function saveRuntime(updates) {
    const next = { ...(await runtime()), ...updates };
    await SLINK.core.storage.set(KEYS.runtime, next);
    return next;
  }

  async function credentials(currentSettings = null) {
    const own = currentSettings || await settings();
    const leveling = await SLINK.core.storage.get('leveling.settings.v1', {});
    return {
      tornKey:String(own.tornKey || leveling?.tornKey || '').trim(),
      ffKey:String(own.ffKey || leveling?.ffKey || '').trim(),
      tornSource:own.tornKey ? 'Bounties' : leveling?.tornKey ? 'Leveling' : '',
      ffSource:own.ffKey ? 'Bounties' : leveling?.ffKey ? 'Leveling' : ''
    };
  }

  function active(lastInteractionAt, now = Date.now()) {
    return Number(lastInteractionAt) > 0 && now - Number(lastInteractionAt) < CORE.ACTIVE_GRACE_MS;
  }

  async function touchActivity() {
    await SLINK.core.storage.set(KEYS.activity, Date.now());
    return publicStatus();
  }

  function cleanNextUrl(input) {
    if (!input) return '';
    try {
      const url = SLINK.core.http.validateUrl('tornApi', input);
      url.searchParams.delete('key');
      return url.href;
    } catch {
      return '';
    }
  }

  function serializeBudget(task) {
    const result = budgetQueue.then(task, task);
    budgetQueue = result.catch(() => undefined);
    return result;
  }

  async function reserveBudget(kind, limit) {
    return serializeBudget(async () => {
      while (true) {
        const now = Date.now();
        const ledger = await SLINK.core.storage.get(KEYS.budgets, { torn:[], ff:[] });
        const recent = (Array.isArray(ledger?.[kind]) ? ledger[kind] : [])
          .map(Number)
          .filter(at => Number.isFinite(at) && at > now - 60_000 && at <= now + 5_000)
          .sort((left, right) => left - right);
        if (recent.length < limit) {
          recent.push(now);
          await SLINK.core.storage.set(KEYS.budgets, { ...ledger, [kind]:recent });
          return;
        }
        await new Promise(resolve => setTimeout(resolve, Math.max(50, Math.min(5_000, recent[0] + 60_025 - now))));
      }
    });
  }

  async function tornRequest(url, key, currentSettings, endpoint) {
    await reserveBudget('torn', currentSettings.tornCallsPerMinute);
    await SLINK.core.tornApiLimiter.reserve({
      wait:true,
      script:'SLINK Bounties',
      priority:'normal',
      endpoint
    });
    const data = await SLINK.core.http.requestJson('tornApi', url, {
      headers:{ Authorization:`ApiKey ${key}` },
      cache:'no-store'
    });
    if (data?.error) throw new Error(data.error.message || data.error.error || 'Torn API request failed.');
    return data;
  }

  function ffRows(response) {
    if (Array.isArray(response)) return response;
    if (Array.isArray(response?.results)) return response.results;
    if (Array.isArray(response?.data)) return response.data;
    const object = response?.results || response?.data || response;
    return object && typeof object === 'object'
      ? Object.entries(object).map(([id, row]) => ({ player_id:Number(row?.player_id ?? row?.id ?? id), ...(row || {}) }))
      : [];
  }

  async function enrichFairFight(targets, key, currentSettings) {
    if (!key || !targets.length) return;
    const cache = await SLINK.core.storage.get(KEYS.fairFight, {});
    const now = Date.now();
    const ids = [...new Set(targets
      .map(target => Number(target?.id))
      .filter(id => Number.isInteger(id) && id > 0)
      .filter(id => now - Number(cache[String(id)]?.checkedAt || 0) >= CORE.FF_CACHE_MS))];
    for (let index = 0; index < ids.length; index += CORE.MAX_FF_TARGETS) {
      const chunk = ids.slice(index, index + CORE.MAX_FF_TARGETS);
      if (!chunk.length) continue;
      await reserveBudget('ff', currentSettings.ffBatchesPerMinute);
      const url = 'https://ffscouter.com/api/v1/get-stats' +
        `?key=${encodeURIComponent(key)}` +
        `&targets=${encodeURIComponent(chunk.join(','))}`;
      const response = await SLINK.core.http.requestJson('ffscouter', url, { cache:'no-store' });
      const returned = new Set();
      for (const row of ffRows(response)) {
        const id = Number(row?.player_id ?? row?.id);
        if (!Number.isInteger(id) || id <= 0) continue;
        returned.add(String(id));
        const fairFight = Number(row?.fair_fight);
        const bsEstimate = Number(row?.bs_estimate);
        cache[id] = {
          fairFight:Number.isFinite(fairFight) && fairFight > 0 ? fairFight : null,
          bsEstimate:Number.isFinite(bsEstimate) && bsEstimate > 0 ? bsEstimate : null,
          source:String(row?.source || 'FFScouter').slice(0, 100),
          checkedAt:now
        };
      }
      for (const id of chunk) {
        if (!returned.has(String(id))) cache[id] = { fairFight:null, bsEstimate:null, source:'FFScouter', checkedAt:now };
      }
      await SLINK.core.storage.set(KEYS.fairFight, cache);
    }
  }

  function freshStart() {
    return {
      ...defaultRuntime(),
      nextUrl:`https://api.torn.com/v2/torn/bounties?limit=${PAGE_LIMIT}&offset=0`,
      scanning:true,
      cycleStatus:'Scanning highest bounties...'
    };
  }

  async function scanBatch(input = {}) {
    if (scanPromise) return scanPromise;
    scanPromise = (async () => {
      const currentSettings = await settings();
      const keys = await credentials(currentSettings);
      const lastInteractionAt = await SLINK.core.storage.get(KEYS.activity, 0);
      if (!currentSettings.enabled) {
        await saveRuntime({ scanning:false, cycleStatus:'Disabled' });
        return publicStatus();
      }
      if (!active(lastInteractionAt)) {
        await saveRuntime({ scanning:false, cycleStatus:'Paused after five minutes away' });
        return publicStatus();
      }
      if (!keys.tornKey) throw new Error('Add a Torn public API key in Bounties or Leveling settings.');
      if (!keys.ffKey && !currentSettings.includeUnknownEstimates) {
        throw new Error('Add an FFScouter key or enable targets without estimates.');
      }

      let currentRuntime = await runtime();
      const shouldRestart = input.forceRestart === true || !currentRuntime.nextUrl ||
        (currentRuntime.completed && Date.now() >= Number(currentRuntime.nextRefreshAt || 0));
      if (shouldRestart) currentRuntime = freshStart();
      else if (currentRuntime.completed) return publicStatus();

      currentRuntime.scanning = true;
      currentRuntime.lastError = '';
      currentRuntime.cycleStatus = 'Scanning highest bounties...';
      await SLINK.core.storage.set(KEYS.runtime, currentRuntime);

      let stop = false;
      for (let page = 0; page < PAGES_PER_BATCH && !stop; page++) {
        const requestUrl = cleanNextUrl(currentRuntime.nextUrl) || `https://api.torn.com/v2/torn/bounties?limit=${PAGE_LIMIT}&offset=${currentRuntime.scannedRows}`;
        const data = await tornRequest(requestUrl, keys.tornKey, currentSettings, '/v2/torn/bounties');
        const rows = Array.isArray(data?.bounties) ? data.bounties : [];
        const eligibleRows = currentSettings.scanFullList
          ? rows
          : rows.filter(row => Number(row?.reward) >= currentSettings.minimumReward);
        currentRuntime.targets = CORE.mergeTargets(currentRuntime.targets, eligibleRows);
        currentRuntime.scannedRows += rows.length;
        currentRuntime.pagesFetched += 1;
        currentRuntime.reportedTotal = Math.max(0, Number(data?._metadata?.total) || currentRuntime.reportedTotal);
        currentRuntime.snapshotTimestamp = Math.max(0, Number(data?.bounties_timestamp) || currentRuntime.snapshotTimestamp);
        currentRuntime.cacheDelaySeconds = Math.max(1, Number(data?.bounties_delay) || currentRuntime.cacheDelaySeconds || 30);
        currentRuntime.nextUrl = cleanNextUrl(data?._metadata?.links?.next);
        const crossedMinimum = !currentSettings.scanFullList && rows.some(row => Number(row?.reward) < currentSettings.minimumReward);
        const exhausted = rows.length < PAGE_LIMIT || !currentRuntime.nextUrl ||
          (currentRuntime.reportedTotal > 0 && currentRuntime.scannedRows >= currentRuntime.reportedTotal);
        stop = crossedMinimum || exhausted;
        currentRuntime.stoppedAtMinimum = crossedMinimum;
        currentRuntime.completed = stop;
        currentRuntime.lastBatchAt = Date.now();
        await SLINK.core.storage.set(KEYS.runtime, currentRuntime);
      }

      await enrichFairFight(currentRuntime.targets, keys.ffKey, currentSettings);
      if (currentRuntime.completed) {
        currentRuntime.nextRefreshAt = Math.max(
          Date.now() + currentRuntime.cacheDelaySeconds * 1000,
          (currentRuntime.snapshotTimestamp + currentRuntime.cacheDelaySeconds) * 1000
        );
      }
      currentRuntime.scanning = false;
      currentRuntime.cycleStatus = currentRuntime.completed
        ? (currentRuntime.stoppedAtMinimum ? `Stopped below $${currentSettings.minimumReward.toLocaleString()}` : 'Full bounty list scanned')
        : `Scanned ${currentRuntime.scannedRows.toLocaleString()} bounty rows`;
      await SLINK.core.storage.set(KEYS.runtime, currentRuntime);
      return publicStatus();
    })();
    try {
      return await scanPromise;
    } catch (error) {
      await saveRuntime({ scanning:false, lastError:SLINK.core.format.errorMessage(error), cycleStatus:'Bounty scan failed' });
      throw error;
    } finally {
      scanPromise = null;
    }
  }

  async function saveSettings(input = {}) {
    const previous = await settings();
    const next = CORE.normalizeSettings({
      ...previous,
      ...input,
      tornKey:input.clearTornKey ? '' : (String(input.tornKey || '').trim() || previous.tornKey),
      ffKey:input.clearFfKey ? '' : (String(input.ffKey || '').trim() || previous.ffKey)
    });
    await SLINK.core.storage.set(KEYS.settings, next);
    const scanShapeChanged = ['minimumReward', 'scanFullList']
      .some(key => JSON.stringify(next[key]) !== JSON.stringify(previous[key]));
    if (!next.enabled || scanShapeChanged) await SLINK.core.storage.set(KEYS.runtime, next.enabled ? freshStart() : defaultRuntime());
    if (next.enabled) await SLINK.core.storage.set(KEYS.activity, Date.now());
    return publicStatus();
  }

  async function observeStatus(input = {}) {
    const targetId = CORE.validTargetId(input.targetId);
    if (!targetId) return publicStatus();
    const currentSettings = await settings();
    const lastInteractionAt = await SLINK.core.storage.get(KEYS.activity, 0);
    if (!currentSettings.enabled || !active(lastInteractionAt)) return publicStatus();
    const currentRuntime = await runtime();
    if (!currentRuntime.targets.some(target => Number(target.id) === targetId)) return publicStatus();
    const cache = await SLINK.core.storage.get(KEYS.status, {});
    let state = CORE.normalizeState(input.state);
    let until = Math.max(0, Number(input.until) || 0);
    let description = String(input.description || '').slice(0, 500);
    let source = String(input.source || 'DOM').slice(0, 40);

    if (state === 'Hospital' && !until && source === 'attack') {
      const keys = await credentials(currentSettings);
      if (keys.tornKey) {
        const data = await tornRequest(
          `https://api.torn.com/v2/user/${targetId}/basic`,
          keys.tornKey,
          currentSettings,
          `/v2/user/${targetId}/basic`
        );
        const status = data?.profile?.status || data?.status || {};
        state = CORE.normalizeState(status.state || state);
        until = Math.max(0, Number(status.until) || 0);
        description = String(status.description || status.details || description).slice(0, 500);
        source = 'attack+api';
      }
    }

    cache[targetId] = { state, until, description, source, checkedAt:Date.now() };
    await SLINK.core.storage.set(KEYS.status, cache);
    return publicStatus();
  }

  async function resetScan() {
    await SLINK.core.storage.set(KEYS.runtime, freshStart());
    return publicStatus();
  }

  async function publicStatus() {
    const [currentSettings, currentRuntime, fairFight, statuses, lastInteractionAt] = await Promise.all([
      settings(), runtime(), SLINK.core.storage.get(KEYS.fairFight, {}),
      SLINK.core.storage.get(KEYS.status, {}), SLINK.core.storage.get(KEYS.activity, 0)
    ]);
    const keys = await credentials(currentSettings);
    const candidates = CORE.filteredCandidates(currentRuntime.targets, fairFight, statuses, currentSettings);
    return {
      configured:Boolean(keys.tornKey && (keys.ffKey || currentSettings.includeUnknownEstimates)),
      active:active(lastInteractionAt),
      settings:{
        ...currentSettings,
        tornKey:undefined,
        ffKey:undefined,
        hasTornKey:Boolean(keys.tornKey),
        hasFfKey:Boolean(keys.ffKey),
        tornKeySource:keys.tornSource,
        ffKeySource:keys.ffSource
      },
      runtime:{
        ...currentRuntime,
        targets:undefined,
        uniqueTargets:currentRuntime.targets.length,
        candidateCount:candidates.length,
        candidates:candidates.slice(0, DISPLAY_LIMIT)
      }
    };
  }

  SLINK.define('services', 'bounties', Object.freeze({
    routes:Object.freeze({
      'bounties.status':publicStatus,
      'bounties.settings.save':saveSettings,
      'bounties.activity.touch':touchActivity,
      'bounties.scan.batch':scanBatch,
      'bounties.scan.reset':resetScan,
      'bounties.status.observe':observeStatus
    }),
    publicStatus,
    scanBatch
  }));
})(globalThis);

