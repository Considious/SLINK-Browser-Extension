(function installWarService(global) {
  'use strict';

  const SLINK = global.SLINK_EXTENSION;
  const WAR = SLINK.core.war;
  const KEYS = Object.freeze({
    settings: 'war.settings.v1',
    terms: 'war.terms.v1',
    acceptedTerms: 'war.acceptedTerms.v1',
    session: 'war.session.v1',
    activeWar: 'war.activeWar.v1',
    runtime: 'war.runtime.v1',
    permissions: 'permissions.war',
    lastStatusAt: 'war.lastStatusAt.v1',
    lastAttackAt: 'war.lastAttackAt.v1',
    lastAttackEnded: 'war.lastAttackEnded.v1',
    storedLogs: 'war.storedLogs.v1',
    lastStoredLogsAt: 'war.lastStoredLogsAt.v1',
    lastOpponentCheckAt: 'war.lastOpponentCheckAt.v1',
    ffCache: 'war.fairFightCache.v1',
    lastFfAt: 'war.lastFairFightAt.v1',
    personalStats: 'war.personalStats.v1',
    seenPersonalAttacks: 'war.seenPersonalAttacks.v1',
    lastPanelStatsAt: 'war.lastPanelStatsAt.v1'
  });
  const STATUS_INTERVAL_MS = 10_000;
  const ATTACK_INTERVAL_MS = 30_000;
  let authenticating = null;
  let cycling = null;

  function defaults() {
    return {
      tornKey: '',
      displayMode: 'torn',
      warMode: 'war',
      idleMinutes: 5,
      ffKey: '',
      minFF: 1,
      maxFF: 3,
      alertSound: true,
      alertPanelFlash: true,
      alertPageFlash: false,
      chainAlert: true,
      turtleAlert: true,
      turtleMinutes: 5
    };
  }

  function defaultRuntime() {
    return {
      status: 'Waiting for an active ranked war',
      lastError: '',
      snapshot: null,
      logs: [],
      logsWarning: '',
      collectStatus: false,
      collectAttacks: false,
      panelStats: { attacks:0, warAttacks:0, mugs:0, chain:null, turtle:null },
      lastCycleAt: 0
    };
  }

  async function settings() {
    return { ...defaults(), ...(await SLINK.core.storage.get(KEYS.settings, {})) };
  }

  async function runtime() {
    return { ...defaultRuntime(), ...(await SLINK.core.storage.get(KEYS.runtime, {})) };
  }

  async function setRuntime(changes) {
    const next = { ...(await runtime()), ...changes };
    await SLINK.core.storage.set(KEYS.runtime, next);
    return next;
  }

  async function fetchTerms(force = false) {
    const cached = await SLINK.core.storage.get(KEYS.terms, null);
    if (!force && cached?.version && cached?.sha256) return cached;
    const response = await SLINK.core.http.requestJson('warWorker', `${WAR.WORKER_BASE}/api/terms`, { cache:'no-store' });
    const terms = {
      version:String(response?.terms?.version || WAR.TERMS_VERSION),
      sha256:String(response?.terms?.sha256 || WAR.TERMS_SHA256),
      documentUrl:String(response?.terms?.url || ''),
      summary:String(response?.terms?.summary || '')
    };
    await SLINK.core.storage.set(KEYS.terms, terms);
    return terms;
  }

  async function health() {
    const startedAt = Date.now();
    try {
      const response = await SLINK.core.http.requestJson('warWorker', `${WAR.WORKER_BASE}/api/health`, { cache:'no-store' });
      return {
        connected:Boolean(response?.ok),
        version:String(response?.version || 'unknown'),
        database:String(response?.database || 'unknown'),
        coordinator:String(response?.coordinator || 'unknown'),
        sessionSecret:String(response?.session_secret || 'unknown'),
        latencyMs:Date.now() - startedAt
      };
    } catch (error) {
      return { connected:false, version:'unknown', database:'unknown', coordinator:'unknown', sessionSecret:'unknown', latencyMs:Date.now() - startedAt, error:SLINK.core.format.errorMessage(error) };
    }
  }

  async function acceptedCurrentTerms(current = null) {
    const terms = current || await fetchTerms();
    const accepted = await SLINK.core.storage.get(KEYS.acceptedTerms, null);
    return Boolean(accepted?.version === terms.version && accepted?.sha256 === terms.sha256);
  }

  async function recomputePermissions() {
    const [leveling, war] = await Promise.all([
      SLINK.core.storage.get('permissions.leveling', null),
      SLINK.core.storage.get(KEYS.permissions, null)
    ]);
    const combined = SLINK.core.permissions.combineSnapshots(leveling, war, {
      userId:null, roles:['foundation'], scopes:[], source:'local-bootstrap', issuedAt:Date.now(), expiresAt:0
    });
    await SLINK.core.storage.set('permissions.snapshot', combined);
    return combined;
  }

  async function clearSession() {
    await SLINK.core.storage.remove(KEYS.session);
    await SLINK.core.storage.remove(KEYS.permissions);
    await recomputePermissions();
  }

  async function workerRequest(path, options = {}, retried = false) {
    const headers = { Accept:'application/json', ...(options.headers || {}) };
    if (options.auth !== false) {
      const session = await ensureSession(false);
      headers.Authorization = `Bearer ${session.token}`;
    }
    const requestOptions = { method:options.method || 'GET', headers, cache:'no-store' };
    if (options.body !== undefined) {
      headers['Content-Type'] = 'application/json';
      requestOptions.body = JSON.stringify(options.body);
    }
    try {
      return await SLINK.core.http.requestJson('warWorker', `${WAR.WORKER_BASE}${path}`, requestOptions);
    } catch (error) {
      if (error.status === 401 && options.auth !== false && !retried) {
        await clearSession();
        await ensureSession(true);
        return workerRequest(path, options, true);
      }
      throw error;
    }
  }

  async function ensureSession(force = false) {
    if (authenticating) return authenticating;
    authenticating = (async () => {
      const currentTerms = await fetchTerms();
      if (!await acceptedCurrentTerms(currentTerms)) {
        const error = new Error('Review and accept the current SLINK API & Data Terms for War.');
        error.code = 'SLINK_WAR_TERMS_REQUIRED';
        throw error;
      }
      const existing = await SLINK.core.storage.get(KEYS.session, null);
      if (!force && existing?.token && Number(existing.expiresAt) > Date.now() + 60_000) return existing;
      const currentSettings = await settings();
      if (!currentSettings.tornKey) {
        const error = new Error('Add your Torn API key in SLINK War settings.');
        error.code = 'SLINK_WAR_TORN_KEY_REQUIRED';
        throw error;
      }
      await SLINK.core.tornApiLimiter.reserve({ wait:true });
      const response = await workerRequest('/api/auth', {
        method:'POST',
        auth:false,
        body:{
          api_key:currentSettings.tornKey,
          terms_accepted:true,
          terms_version:currentTerms.version,
          terms_sha256:currentTerms.sha256,
          client_name:'SLINK Browser Extension',
          client_version:SLINK.VERSION
        }
      });
      if (!response?.session_token) throw new Error('SLINK War did not return a session token.');
      const session = {
        token:String(response.session_token),
        expiresAt:Date.parse(response.expires_at) || 0,
        userId:Number(response.user_id) || null,
        userName:String(response.user_name || `Player ${response.user_id}`),
        factionId:Number(response.faction_id) || 0,
        roles:Array.isArray(response.roles) ? response.roles : [],
        scopes:Array.isArray(response.scopes) ? response.scopes : []
      };
      if (!SLINK.core.permissions.hasScope(session, 'slink.war')) throw new Error('Your SLINK account does not have slink.war permission.');
      await SLINK.core.storage.set(KEYS.session, session);
      await SLINK.core.storage.set(KEYS.permissions, {
        userId:session.userId,
        roles:session.roles,
        scopes:session.scopes,
        source:'slink-war-session',
        issuedAt:Date.now(),
        expiresAt:session.expiresAt
      });
      await recomputePermissions();
      return session;
    })();
    try {
      return await authenticating;
    } finally {
      authenticating = null;
    }
  }

  async function tornRequest(path, apiKey) {
    await SLINK.core.tornApiLimiter.reserve({ wait:true });
    return SLINK.core.http.requestJson('tornApi', `https://api.torn.com${path}`, {
      headers:{ Authorization:`ApiKey ${apiKey}` },
      cache:'no-store'
    });
  }

  function warFactionEntries(factions) {
    if (Array.isArray(factions)) {
      return factions.map(faction => [WAR.positiveInteger(faction?.id ?? faction?.faction_id ?? faction?.faction?.id), faction]).filter(([id]) => id);
    }
    if (!factions || typeof factions !== 'object') return [];
    return Object.entries(factions).map(([key, faction]) => [WAR.positiveInteger(faction?.id ?? faction?.faction_id ?? faction?.faction?.id ?? key), faction]).filter(([id]) => id);
  }

  function currentRankedWar(payload, ownFactionId, now = Math.floor(Date.now() / 1000)) {
    const wars = payload?.rankedwars ?? payload?.ranked_wars ?? payload?.wars ?? [];
    const entries = Array.isArray(wars)
      ? wars.map((war, index) => [String(war?.id ?? war?.ranked_war_id ?? index), war])
      : Object.entries(wars || {});
    const active = entries.find(([, war]) => {
      const start = Number(war?.war?.start ?? war?.start ?? war?.started ?? 0);
      const end = Number(war?.war?.end ?? war?.end ?? war?.ended ?? 0);
      return start > 0 && start <= now && (!end || end > now);
    });
    if (!active) return null;
    const [entryId, war] = active;
    const opponent = warFactionEntries(war?.factions ?? war?.war?.factions)
      .find(([id]) => id !== Number(ownFactionId));
    if (!opponent) return null;
    const [opponentFactionId, faction] = opponent;
    return {
      opponentFactionId,
      opponentName:String(faction?.name || `Faction ${opponentFactionId}`),
      startedAt:Number(war?.war?.start ?? war?.start ?? war?.started ?? 0) * 1000,
      rankedWarId:String(war?.id ?? war?.ranked_war_id ?? war?.war?.id ?? entryId)
    };
  }

  async function discoverActiveWar(session, currentSettings, force = false) {
    const lastCheck = Number(await SLINK.core.storage.get(KEYS.lastOpponentCheckAt, 0)) || 0;
    const cached = await SLINK.core.storage.get(KEYS.activeWar, null);
    if (!force && cached?.warId && Date.now() - lastCheck < 5 * 60 * 1000) return cached;
    const payload = await tornRequest(`/v2/faction/${encodeURIComponent(session.factionId)}/rankedwars?sort=desc&limit=10`, currentSettings.tornKey);
    await SLINK.core.storage.set(KEYS.lastOpponentCheckAt, Date.now());
    const detected = currentRankedWar(payload, session.factionId);
    if (!detected) {
      await SLINK.core.storage.remove(KEYS.activeWar);
      return null;
    }
    return registerActiveWar(detected);
  }

  async function registerActiveWar(input = {}) {
    const session = await ensureSession(false);
    const opponentFactionId = WAR.positiveInteger(input.opponentFactionId ?? input.opponent_faction_id);
    if (!opponentFactionId || opponentFactionId === session.factionId) throw new Error('SLINK War could not identify the opposing faction.');
    const previous = await SLINK.core.storage.get(KEYS.activeWar, null);
    const incomingRankedWarId = String(input.rankedWarId ?? input.ranked_war_id ?? '');
    const sameWar = Number(previous?.ownFactionId) === session.factionId &&
      Number(previous?.opponentFactionId) === opponentFactionId &&
      (!incomingRankedWarId || !previous?.rankedWarId || String(previous.rankedWarId) === incomingRankedWarId);
    const startedAt = sameWar
      ? Number(previous.startedAt)
      : Math.max(1, Number(input.startedAt ?? input.started_at) || Date.now());
    const activeWar = {
      warId:WAR.makeWarId(session.factionId, opponentFactionId, startedAt),
      ownFactionId:session.factionId,
      opponentFactionId,
      opponentName:String(input.opponentName ?? input.opponent_name ?? previous?.opponentName ?? `Faction ${opponentFactionId}`),
      startedAt,
      rankedWarId:String(incomingRankedWarId || previous?.rankedWarId || ''),
      detectedAt:Date.now()
    };
    if (!sameWar) {
      await Promise.all([
        SLINK.core.storage.set(KEYS.personalStats, { warId:activeWar.warId, attacks:0, warAttacks:0, mugs:0 }),
        SLINK.core.storage.set(KEYS.seenPersonalAttacks, { warId:activeWar.warId, ids:[] })
      ]);
    }
    await SLINK.core.storage.set(KEYS.activeWar, activeWar);
    return activeWar;
  }

  async function collectStatus(activeWar, currentSettings) {
    const response = await tornRequest(`/v2/faction/${encodeURIComponent(activeWar.opponentFactionId)}/members`, currentSettings.tornKey);
    const members = response?.members ?? response?.faction?.members ?? [];
    if (!Array.isArray(members) || !members.length) throw new Error('Torn returned no opposing faction members.');
    await workerRequest(`/api/wars/${encodeURIComponent(activeWar.warId)}/status`, {
      method:'POST',
      body:{ opponent_faction_id:activeWar.opponentFactionId, observedAt:Date.now(), members }
    });
    await SLINK.core.storage.set(KEYS.lastStatusAt, Date.now());
    return members.length;
  }

  async function collectAttacks(activeWar, currentSettings) {
    const session = await ensureSession(false);
    const now = Math.floor(Date.now() / 1000);
    const previous = Number(await SLINK.core.storage.get(KEYS.lastAttackEnded, 0)) || 0;
    const from = Math.max(now - 10 * 60, previous ? previous - 60 : 0);
    const response = await tornRequest(`/v2/faction/attacks?from=${from}&to=${now}&limit=100&sort=desc`, currentSettings.tornKey);
    const attacks = Array.isArray(response?.attacks) ? response.attacks : [];
    await workerRequest(`/api/wars/${encodeURIComponent(activeWar.warId)}/attacks`, {
      method:'POST',
      body:{ opponent_faction_id:activeWar.opponentFactionId, attacks }
    });
    const newest = attacks.reduce((maximum, attack) => Math.max(maximum, Number(attack?.ended ?? attack?.ended_at ?? 0) || 0), previous);
    const [storedStats, storedSeen] = await Promise.all([
      SLINK.core.storage.get(KEYS.personalStats, { warId:activeWar.warId, attacks:0, warAttacks:0, mugs:0 }),
      SLINK.core.storage.get(KEYS.seenPersonalAttacks, { warId:activeWar.warId, ids:[] })
    ]);
    const stats = storedStats?.warId === activeWar.warId ? { ...storedStats } : { warId:activeWar.warId, attacks:0, warAttacks:0, mugs:0 };
    const seen = new Set(storedSeen?.warId === activeWar.warId ? storedSeen.ids || [] : []);
    for (const attack of attacks) {
      const id = String(attack?.id ?? attack?.attack_id ?? '');
      const attackerId = Number(attack?.attacker?.id ?? attack?.attacker_id ?? 0);
      if (!id || attackerId !== Number(session.userId) || seen.has(id)) continue;
      seen.add(id);
      stats.attacks += 1;
      const defenderFaction = Number(attack?.defender?.faction?.id ?? attack?.defender?.faction_id ?? attack?.defender_faction_id ?? 0);
      if (attack?.is_ranked_war === true || defenderFaction === Number(activeWar.opponentFactionId)) stats.warAttacks += 1;
      if (String(attack?.result ?? attack?.outcome ?? '').toLowerCase() === 'mugged') stats.mugs += 1;
    }
    await Promise.all([
      SLINK.core.storage.set(KEYS.lastAttackAt, Date.now()),
      SLINK.core.storage.set(KEYS.lastAttackEnded, newest),
      SLINK.core.storage.set(KEYS.personalStats, stats),
      SLINK.core.storage.set(KEYS.seenPersonalAttacks, { warId:activeWar.warId, ids:[...seen].slice(-1000) })
    ]);
    return attacks.length;
  }

  function fairFightValue(row) {
    for (const value of [row?.fair_fight, row?.fairFight, row?.ff, row?.ff_score, row?.score, row?.estimate?.fair_fight]) {
      const number = Number(value);
      if (Number.isFinite(number)) return number;
    }
    return null;
  }

  function battleStatsValue(row) {
    for (const value of [row?.bs_estimate, row?.battle_stats_estimate, row?.battleStatsEstimate, row?.total_stats, row?.estimate?.battle_stats]) {
      const number = Number(value);
      if (Number.isFinite(number) && number >= 0) return number;
    }
    return null;
  }

  async function refineMembers(members, currentSettings) {
    const values = Array.isArray(members) ? members : [];
    if (!currentSettings.ffKey || !values.length) return values;
    const now = Date.now();
    const cache = await SLINK.core.storage.get(KEYS.ffCache, {});
    const missing = values.filter(member => !cache[member.id] || now - Number(cache[member.id].checkedAt) > 5 * 60 * 1000).map(member => member.id);
    for (let index = 0; index < missing.length; index += 100) {
      const targets = missing.slice(index, index + 100);
      const response = await SLINK.core.http.requestJson('ffscouter', `https://ffscouter.com/api/v1/get-stats?key=${encodeURIComponent(currentSettings.ffKey)}&targets=${targets.join(',')}`, { cache:'no-store' });
      const rows = Array.isArray(response) ? response : response?.data ?? response?.results ?? [];
      const returned = new Set();
      for (const row of rows) {
        const id = WAR.positiveInteger(row?.player_id ?? row?.id ?? row?.user_id);
        if (!id) continue;
        returned.add(id);
        cache[id] = { value:fairFightValue(row), battleStatsEstimate:battleStatsValue(row), checkedAt:now };
      }
      for (const id of targets) if (!returned.has(id)) cache[id] = { value:null, checkedAt:now };
    }
    await SLINK.core.storage.set(KEYS.ffCache, cache);
    return values.map(member => ({
      ...member,
      fairFight:Number.isFinite(Number(cache[member.id]?.value)) ? Number(cache[member.id].value) : null,
      battleStatsEstimate:Number.isFinite(Number(cache[member.id]?.battleStatsEstimate)) ? Number(cache[member.id].battleStatsEstimate) : null
    }));
  }

  async function refreshPanelStats(activeWar, currentSettings) {
    const last = Number(await SLINK.core.storage.get(KEYS.lastPanelStatsAt, 0)) || 0;
    const previousRuntime = await runtime();
    if (Date.now() - last < 60_000) return previousRuntime.panelStats || defaultRuntime().panelStats;
    try {
      const session = await ensureSession(false);
      const nowSeconds = Math.floor(Date.now() / 1000);
      const from = Math.max(Math.floor(Number(activeWar.startedAt) / 1000) || nowSeconds - 600, nowSeconds - 600);
      const response = await tornRequest(`/v2/user/attacks?from=${from}&to=${nowSeconds}&limit=100&sort=desc`, currentSettings.tornKey);
      const attacks = Array.isArray(response?.attacks) ? response.attacks : [];
      const [savedStats, savedSeen] = await Promise.all([
        SLINK.core.storage.get(KEYS.personalStats, { warId:activeWar.warId, attacks:0, warAttacks:0, mugs:0 }),
        SLINK.core.storage.get(KEYS.seenPersonalAttacks, { warId:activeWar.warId, ids:[] })
      ]);
      const nextStats = savedStats?.warId === activeWar.warId ? { ...savedStats } : { warId:activeWar.warId, attacks:0, warAttacks:0, mugs:0 };
      const seen = new Set(savedSeen?.warId === activeWar.warId ? savedSeen.ids || [] : []);
      for (const attack of attacks) {
        const id = String(attack?.id ?? attack?.attack_id ?? '');
        const attackerId = Number(attack?.attacker?.id ?? attack?.attacker_id ?? session.userId);
        if (!id || attackerId !== Number(session.userId) || seen.has(id)) continue;
        seen.add(id); nextStats.attacks += 1;
        const defenderFaction = Number(attack?.defender?.faction?.id ?? attack?.defender?.faction_id ?? attack?.defender_faction_id ?? 0);
        if (attack?.is_ranked_war === true || defenderFaction === Number(activeWar.opponentFactionId)) nextStats.warAttacks += 1;
        if (String(attack?.result ?? attack?.outcome ?? '').toLowerCase() === 'mugged') nextStats.mugs += 1;
      }
      await Promise.all([
        SLINK.core.storage.set(KEYS.personalStats, nextStats),
        SLINK.core.storage.set(KEYS.seenPersonalAttacks, { warId:activeWar.warId, ids:[...seen].slice(-1000) })
      ]);
    } catch { /* Public Only keys cannot read personal attacks; shared War features continue. */ }
    const stored = await SLINK.core.storage.get(KEYS.personalStats, { warId:activeWar.warId, attacks:0, warAttacks:0, mugs:0 });
    const panelStats = {
      attacks:stored?.warId === activeWar.warId ? Number(stored.attacks) || 0 : 0,
      warAttacks:stored?.warId === activeWar.warId ? Number(stored.warAttacks) || 0 : 0,
      mugs:stored?.warId === activeWar.warId ? Number(stored.mugs) || 0 : 0,
      chain:previousRuntime.panelStats?.chain || null,
      turtle:previousRuntime.panelStats?.turtle || null
    };
    try {
      const chainPayload = await tornRequest('/v2/faction/chain', currentSettings.tornKey);
      const chain = chainPayload?.chain ?? chainPayload;
      panelStats.chain = {
        id:String(chain?.id ?? chain?.chain_id ?? ''),
        current:Number(chain?.current ?? chain?.hits ?? chain?.length ?? 0) || 0,
        target:Number(chain?.max ?? chain?.target ?? 0) || 0,
        secondsLeft:Number(chain?.timeout ?? chain?.seconds_left ?? chain?.time_left ?? 0) || 0
      };
    } catch { /* Public keys or no active chain can leave chain state unavailable. */ }
    try {
      const profile = await tornRequest('/v2/user/basic', currentSettings.tornKey);
      const status = profile?.status ?? profile?.profile?.status ?? {};
      panelStats.turtle = {
        hospitalized:/hospital/i.test(String(status?.state || '')),
        until:Number(status?.until ?? 0) || 0,
        description:String(status?.description || '')
      };
    } catch { /* Keep the last known turtle state when the selection is unavailable. */ }
    await SLINK.core.storage.set(KEYS.lastPanelStatsAt, Date.now());
    return panelStats;
  }

  async function fetchSnapshot(activeWar, currentSettings) {
    const query = new URLSearchParams({
      opponent_faction_id:String(activeWar.opponentFactionId),
      mode:currentSettings.warMode,
      idle_minutes:String(currentSettings.idleMinutes)
    });
    return workerRequest(`/api/wars/${encodeURIComponent(activeWar.warId)}/snapshot?${query}`);
  }

  async function saveSharedConfig(input = {}) {
    const session = await ensureSession(false);
    if (!SLINK.core.permissions.hasScope(session, 'slink.war.officer') && !SLINK.core.permissions.hasScope(session, 'admin.*')) {
      throw new Error('slink.war.officer permission is required to change faction-wide War settings.');
    }
    const activeWar = await SLINK.core.storage.get(KEYS.activeWar, null);
    if (!activeWar?.warId) throw new Error('An active ranked war is required before changing faction-wide War settings.');
    const result = await workerRequest(`/api/wars/${encodeURIComponent(activeWar.warId)}/config`, {
      method:'POST',
      body:{
        opponent_faction_id:activeWar.opponentFactionId,
        mode:input.mode === 'termed' ? 'termed' : 'war',
        idleMinutes:Math.max(0, Math.min(60, Number(input.idleMinutes) || 0))
      }
    });
    await setRuntime({ snapshot:{ ...((await runtime()).snapshot || {}), config:result.config, mode:result.config?.mode || 'war' } });
    return publicStatus();
  }

  async function updateClaim(input = {}) {
    const activeWar = await SLINK.core.storage.get(KEYS.activeWar, null);
    if (!activeWar?.warId) throw new Error('An active ranked war is required to manage med-out claims.');
    await workerRequest(`/api/wars/${encodeURIComponent(activeWar.warId)}/claims`, {
      method:'POST',
      body:{
        opponent_faction_id:activeWar.opponentFactionId,
        operation:input.operation === 'release' ? 'release' : 'claim',
        targetId:WAR.positiveInteger(input.targetId),
        targetName:String(input.targetName || ''),
        minutes:Math.max(5, Math.min(180, Number(input.minutes) || 30))
      }
    });
    return prepareCycle();
  }

  async function fetchLogs(activeWar, forceStored = false, pendingLogs = []) {
    const [cached, lastRead] = await Promise.all([
      SLINK.core.storage.get(KEYS.storedLogs, null),
      SLINK.core.storage.get(KEYS.lastStoredLogsAt, null)
    ]);
    const includeStored = forceStored || cached?.warId !== activeWar.warId || lastRead?.warId !== activeWar.warId || Date.now() - Number(lastRead?.at) >= 10 * 60 * 1000;
    let stored = Array.isArray(cached?.rows) && cached?.warId === activeWar.warId ? cached.rows : [];
    let storageWarning = cached?.warId === activeWar.warId ? String(cached.storageWarning || '') : '';
    if (includeStored) {
      const result = await workerRequest(`/api/wars/${encodeURIComponent(activeWar.warId)}/logs?limit=200&include_stored=1`);
      stored = Array.isArray(result?.stored) ? result.stored : [];
      pendingLogs = Array.isArray(result?.pending) ? result.pending : pendingLogs;
      if (result?.storedAvailable === false) storageWarning = String(result.storageWarning || 'Historical War logs are temporarily unavailable; live War data is still active.');
      await Promise.all([
        SLINK.core.storage.set(KEYS.storedLogs, { warId:activeWar.warId, rows:stored, storageWarning }),
        SLINK.core.storage.set(KEYS.lastStoredLogsAt, { warId:activeWar.warId, at:Date.now() })
      ]);
    }
    return {
      rows:SLINK.core.war.summarizeLogs({ stored, pending:pendingLogs }),
      warning:storageWarning
    };
  }

  async function prepareCycle(payload = {}) {
    if (cycling) return cycling;
    cycling = (async () => {
      const currentSettings = await settings();
      const session = await ensureSession(false);
      let activeWar = await SLINK.core.storage.get(KEYS.activeWar, null);
      if (WAR.positiveInteger(payload.opponentFactionId ?? payload.opponent_faction_id)) activeWar = await registerActiveWar(payload);
      if (!activeWar?.warId || payload.forceOpponentRefresh === true) {
        activeWar = await discoverActiveWar(session, currentSettings, payload.forceOpponentRefresh === true);
      }
      if (!activeWar?.warId) {
        await setRuntime({ status:'No active ranked war was found through the Torn API.', lastError:'', lastCycleAt:Date.now() });
        return publicStatus();
      }
      const heartbeat = await workerRequest(`/api/wars/${encodeURIComponent(activeWar.warId)}/heartbeat`, {
        method:'POST', body:{ opponent_faction_id:activeWar.opponentFactionId }
      });
      const now = Date.now();
      const [lastStatusAt, lastAttackAt] = await Promise.all([
        SLINK.core.storage.get(KEYS.lastStatusAt, 0),
        SLINK.core.storage.get(KEYS.lastAttackAt, 0)
      ]);
      let statusChecks = 0;
      let attackChecks = 0;
      if (heartbeat.collectStatus && now - Number(lastStatusAt) >= STATUS_INTERVAL_MS) statusChecks = await collectStatus(activeWar, currentSettings);
      if (
        heartbeat.collectAttacks &&
        SLINK.core.permissions.hasScope(session, 'slink.war.faction') &&
        now - Number(lastAttackAt) >= ATTACK_INTERVAL_MS
      ) attackChecks = await collectAttacks(activeWar, currentSettings);
      const snapshot = await fetchSnapshot(activeWar, currentSettings);
      snapshot.members = await refineMembers(snapshot?.members || [], currentSettings);
      const canViewLogs = SLINK.core.permissions.hasScope(session, 'slink.war.officer') || SLINK.core.permissions.hasScope(session, 'admin.*');
      let logs = [];
      let logsWarning = '';
      if (canViewLogs) {
        try {
          const logResult = await fetchLogs(activeWar, false, snapshot?.pendingLogs || []);
          logs = logResult.rows;
          logsWarning = logResult.warning;
        } catch (error) {
          logs = SLINK.core.war.summarizeLogs({ stored:[], pending:snapshot?.pendingLogs || [] });
          logsWarning = `Historical War logs are unavailable: ${SLINK.core.format.errorMessage(error)} Live targets and retals are still active.`;
        }
      }
      const panelStats = await refreshPanelStats(activeWar, currentSettings);
      await setRuntime({
        status:`${snapshot.members?.length || 0} targets / ${snapshot.retals?.length || 0} active retals`,
        lastError:'',
        snapshot,
        logs,
        logsWarning,
        collectStatus:Boolean(heartbeat.collectStatus),
        collectAttacks:Boolean(heartbeat.collectAttacks),
        statusChecks,
        attackChecks,
        panelStats,
        lastCycleAt:Date.now()
      });
      return publicStatus();
    })();
    try {
      return await cycling;
    } catch (error) {
      await setRuntime({ lastError:SLINK.core.format.errorMessage(error), status:'War update failed', lastCycleAt:Date.now() });
      throw error;
    } finally {
      cycling = null;
    }
  }

  async function saveSettings(input = {}) {
    const current = await settings();
    const displayMode = ['extension', 'torn', 'hybrid'].includes(input.displayMode) ? input.displayMode : current.displayMode;
    const next = {
      ...current,
      tornKey:input.clearTornKey === true ? '' : (String(input.tornKey || '').trim() || current.tornKey),
      ffKey:input.clearFfKey === true ? '' : (String(input.ffKey || '').trim() || current.ffKey),
      displayMode,
      warMode:input.warMode === 'termed' ? 'termed' : (input.warMode === 'war' ? 'war' : current.warMode),
      idleMinutes:Math.max(0, Math.min(60, Number(input.idleMinutes ?? current.idleMinutes) || 0)),
      minFF:Math.max(1, Math.min(3, Number(input.minFF ?? current.minFF) || 1)),
      maxFF:Math.max(1, Math.min(3, Number(input.maxFF ?? current.maxFF) || 3)),
      alertSound:input.alertSound === undefined ? current.alertSound : input.alertSound === true,
      alertPanelFlash:input.alertPanelFlash === undefined ? current.alertPanelFlash : input.alertPanelFlash === true,
      alertPageFlash:input.alertPageFlash === undefined ? current.alertPageFlash : input.alertPageFlash === true,
      chainAlert:input.chainAlert === undefined ? current.chainAlert : input.chainAlert === true,
      turtleAlert:input.turtleAlert === undefined ? current.turtleAlert : input.turtleAlert === true,
      turtleMinutes:Math.max(1, Math.min(60, Number(input.turtleMinutes ?? current.turtleMinutes) || 5))
    };
    await SLINK.core.storage.set(KEYS.settings, next);
    await SLINK.core.storage.set('ui.modules.war.showInTorn', displayMode !== 'extension');
    if (input.acceptTerms === true) {
      const terms = await fetchTerms();
      await SLINK.core.storage.set(KEYS.acceptedTerms, { version:terms.version, sha256:terms.sha256, acceptedAt:Date.now() });
    }
    if (String(input.tornKey || '').trim() || input.acceptTerms === true) await ensureSession(true);
    return publicStatus();
  }

  async function publicStatus() {
    const [currentSettings, currentRuntime, terms, accepted, session, activeWar, permissions] = await Promise.all([
      settings(), runtime(), fetchTerms().catch(() => ({ version:WAR.TERMS_VERSION, sha256:WAR.TERMS_SHA256, documentUrl:'', summary:'' })),
      acceptedCurrentTerms().catch(() => false),
      SLINK.core.storage.get(KEYS.session, null),
      SLINK.core.storage.get(KEYS.activeWar, null),
      SLINK.core.storage.get(KEYS.permissions, null)
    ]);
    const authenticated = Boolean(session?.token && Number(session.expiresAt) > Date.now());
    return {
      configured:Boolean(currentSettings.tornKey && accepted),
      settings:{
        hasTornKey:Boolean(currentSettings.tornKey),
        hasFfKey:Boolean(currentSettings.ffKey),
        displayMode:currentSettings.displayMode,
        warMode:currentSettings.warMode,
        idleMinutes:currentSettings.idleMinutes,
        minFF:currentSettings.minFF,
        maxFF:currentSettings.maxFF,
        alertSound:currentSettings.alertSound,
        alertPanelFlash:currentSettings.alertPanelFlash,
        alertPageFlash:currentSettings.alertPageFlash,
        chainAlert:currentSettings.chainAlert,
        turtleAlert:currentSettings.turtleAlert,
        turtleMinutes:currentSettings.turtleMinutes
      },
      terms:{ ...terms, accepted },
      session:{
        authenticated,
        userId:authenticated ? session.userId : null,
        factionId:authenticated ? session.factionId : 0,
        userName:authenticated ? session.userName : '',
        factionCapable:authenticated && SLINK.core.permissions.hasScope(session, 'slink.war.faction'),
        officer:authenticated && (SLINK.core.permissions.hasScope(session, 'slink.war.officer') || SLINK.core.permissions.hasScope(session, 'admin.*')),
        canViewLogs:authenticated && (SLINK.core.permissions.hasScope(session, 'slink.war.officer') || SLINK.core.permissions.hasScope(session, 'admin.*')),
        expiresAt:authenticated ? session.expiresAt : 0
      },
      permissions:SLINK.core.permissions.normalizeSnapshot(permissions || {}),
      sharedConfig:currentRuntime?.snapshot?.config || { mode:currentSettings.warMode, idleMinutes:currentSettings.idleMinutes, updatedBy:0, updatedAt:0 },
      activeWar,
      runtime:currentRuntime
    };
  }

  const api = Object.freeze({
    routes:Object.freeze({
      'war.status': publicStatus,
      'war.health': health,
      'war.terms': () => fetchTerms(true),
      'war.settings.save': saveSettings,
      'war.session.clear': async () => { await clearSession(); return publicStatus(); },
      'war.active.detect': async payload => { const activeWar = await registerActiveWar(payload); return { activeWar, status:await publicStatus() }; },
      'war.cycle.prepare': prepareCycle,
      'war.config.save': saveSharedConfig,
      'war.claims.update': updateClaim,
      'war.logs': async () => {
        const session = await ensureSession(false);
        if (!SLINK.core.permissions.hasScope(session, 'slink.war.officer') && !SLINK.core.permissions.hasScope(session, 'admin.*')) throw new Error('slink.war.officer permission is required to view War logs.');
        const activeWar = await SLINK.core.storage.get(KEYS.activeWar, null);
        return activeWar?.warId ? (await fetchLogs(activeWar, true)).rows : [];
      },
      'war.admin.scopes': async () => {
        const session = await ensureSession(false);
        if (!SLINK.core.permissions.hasScope(session, 'admin.*')) throw new Error('admin.* permission is required.');
        return workerRequest('/api/admin/scopes');
      },
      'war.admin.permissions.get': async payload => {
        const session = await ensureSession(false);
        if (!SLINK.core.permissions.hasScope(session, 'admin.*')) throw new Error('admin.* permission is required.');
        const userId = WAR.positiveInteger(payload?.userId);
        if (!userId) throw new Error('Enter a valid Torn user ID.');
        return workerRequest(`/api/admin/users/${userId}/permissions`);
      },
      'war.admin.permissions.save': async payload => {
        const session = await ensureSession(false);
        if (!SLINK.core.permissions.hasScope(session, 'admin.*')) throw new Error('admin.* permission is required.');
        const userId = WAR.positiveInteger(payload?.userId);
        if (!userId) throw new Error('Enter a valid Torn user ID.');
        return workerRequest(`/api/admin/users/${userId}/permissions`, {
          method:'POST',
          body:{ scopes:Array.isArray(payload?.scopes) ? payload.scopes : [], hours:payload?.hours, note:payload?.note }
        });
      }
    }),
    prepareCycle,
    health,
    publicStatus
  });

  SLINK.define('services', 'war', api);
})(globalThis);
