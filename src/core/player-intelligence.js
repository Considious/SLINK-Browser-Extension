(function installPlayerIntelligence(global) {
  'use strict';

  const SLINK = global.SLINK_EXTENSION;
  if (!SLINK) throw new Error('SLINK runtime must load before player intelligence.');

  const DEFAULT_FRESH_MS = 60_000;
  const TIMER_BUFFER_MS = 15_000;
  const TIMED_STATES = new Set(['Hospital', 'Jail', 'Traveling']);

  function validPlayerId(value) {
    const parsed = Number(value);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
  }

  function normalizeState(value) {
    const text = String(value || '').trim();
    const lower = text.toLowerCase();
    if (!lower) return 'Unknown';
    if (lower.includes('federal')) return 'Federal';
    if (lower.includes('hospital')) return 'Hospital';
    if (lower.includes('jail')) return 'Jail';
    if (lower.includes('travel') || lower.includes('flying')) return 'Traveling';
    if (lower.includes('hiding')) return 'Hiding Out';
    if (lower.includes('abroad')) return 'Abroad';
    if (lower === 'okay' || lower === 'ok') return 'Okay';
    if (lower.includes('fallen')) return 'Fallen';
    return text.slice(0, 40);
  }

  function normalizeUntil(value) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed <= 0) return 0;
    return Math.trunc(parsed > 10_000_000_000 ? parsed / 1000 : parsed);
  }

  function untilMilliseconds(record = {}) {
    const seconds = normalizeUntil(record.until ?? record.statusUntil);
    return seconds > 0 ? seconds * 1000 : 0;
  }

  function normalizeRecord(input = {}, existing = {}) {
    const playerId = validPlayerId(
      input.playerId ?? input.player_id ?? input.targetId ?? input.id ??
      existing.playerId ?? existing.id
    );
    if (!playerId) throw new Error('A valid Torn player ID is required.');
    const observedAt = Math.max(
      0,
      Number(input.observedAt ?? input.checkedAt ?? input.updatedAt) || Date.now()
    );
    const state = normalizeState(
      input.state ?? input.status?.state ?? existing.state ?? existing.status?.state
    );
    const until = normalizeUntil(
      input.until ?? input.statusUntil ?? input.status?.until ??
      existing.until ?? existing.status?.until
    );
    const description = String(
      input.description ?? input.status?.description ??
      existing.description ?? existing.status?.description ?? ''
    ).slice(0, 500);
    const source = String(input.source || existing.source || 'unknown').slice(0, 80);
    const bountyCount = Math.max(
      0,
      Math.trunc(Number(input.bountyCount ?? input.bounty_count ??
        existing.bountyCount) || 0)
    );
    const bountyTotal = Math.max(
      0,
      Number(input.bountyTotal ?? input.bounty_total ?? existing.bountyTotal) || 0
    );
    return {
      playerId,
      id:playerId,
      name:String(input.name ?? existing.name ?? `Player ${playerId}`).slice(0, 80),
      level:Math.max(0, Number(input.level ?? existing.level) || 0),
      state,
      until,
      description,
      source,
      observedAt,
      checkedAt:Math.max(0, Number(input.checkedAt) || observedAt),
      fairFight:Number.isFinite(Number(input.fairFight ?? existing.fairFight))
        ? Number(input.fairFight ?? existing.fairFight)
        : null,
      battleStatsEstimate:Number.isFinite(Number(
        input.battleStatsEstimate ?? input.bsEstimate ??
        existing.battleStatsEstimate
      ))
        ? Number(input.battleStatsEstimate ?? input.bsEstimate ??
          existing.battleStatsEstimate)
        : null,
      bountyCount,
      bountyTotal,
      lastSeenMugged:Math.max(
        0,
        Number(input.lastSeenMugged ?? existing.lastSeenMugged) || 0
      ),
      sources:[...new Set([
        ...(Array.isArray(existing.sources) ? existing.sources : []),
        ...(Array.isArray(input.sources) ? input.sources : []),
        source
      ].map(String).filter(Boolean))].sort()
    };
  }

  function mergeRecord(existing = null, incoming = {}) {
    const previous = existing && typeof existing === 'object'
      ? normalizeRecord(existing)
      : null;
    const next = normalizeRecord(incoming, previous || {});
    if (!previous) return next;
    const useIncomingStatus = next.observedAt >= previous.observedAt;
    const merged = {
      ...previous,
      playerId:next.playerId,
      id:next.playerId,
      name:next.name !== `Player ${next.playerId}` || !previous.name
        ? next.name
        : previous.name,
      level:next.level || previous.level,
      fairFight:next.fairFight ?? previous.fairFight,
      battleStatsEstimate:
        next.battleStatsEstimate ?? previous.battleStatsEstimate,
      bountyCount:Object.hasOwn(incoming, 'bountyCount') ||
        Object.hasOwn(incoming, 'bounty_count')
        ? next.bountyCount
        : previous.bountyCount,
      bountyTotal:Object.hasOwn(incoming, 'bountyTotal') ||
        Object.hasOwn(incoming, 'bounty_total')
        ? next.bountyTotal
        : previous.bountyTotal,
      lastSeenMugged:Math.max(previous.lastSeenMugged, next.lastSeenMugged),
      checkedAt:Math.max(previous.checkedAt, next.checkedAt),
      observedAt:Math.max(previous.observedAt, next.observedAt),
      sources:[...new Set([...previous.sources, ...next.sources])].sort()
    };
    if (useIncomingStatus) {
      merged.state = next.state;
      merged.until = next.until;
      merged.description = next.description;
      merged.source = next.source;
    }
    return merged;
  }

  function effectiveStatus(record = {}, now = Date.now()) {
    const normalized = normalizeRecord(record);
    const untilMs = untilMilliseconds(normalized);
    if (TIMED_STATES.has(normalized.state) && untilMs > 0 && untilMs <= now) {
      return {
        state:'Okay',
        until:0,
        description:'Known timer expired; presumed Okay until refreshed.',
        presumed:true,
        source:normalized.source
      };
    }
    return {
      state:normalized.state,
      until:normalized.until,
      description:normalized.description,
      presumed:false,
      source:normalized.source
    };
  }

  function requestDecision(
    record,
    {
      now = Date.now(),
      maxAgeMs = DEFAULT_FRESH_MS,
      timerBufferMs = TIMER_BUFFER_MS,
      forceApi = false
    } = {}
  ) {
    if (forceApi) return { required:true, reason:'forced', nextCheckAt:now };
    if (!record) return { required:true, reason:'missing', nextCheckAt:now };
    const normalized = normalizeRecord(record);
    const untilMs = untilMilliseconds(normalized);
    if (
      TIMED_STATES.has(normalized.state) &&
      untilMs > now + Math.max(0, Number(timerBufferMs) || 0)
    ) {
      return {
        required:false,
        reason:'known-timer',
        nextCheckAt:untilMs + Math.max(0, Number(timerBufferMs) || 0)
      };
    }
    const observedAt = Math.max(0, Number(normalized.observedAt) || 0);
    const freshness = Math.max(0, Number(maxAgeMs) || 0);
    if (observedAt > 0 && now - observedAt < freshness) {
      return {
        required:false,
        reason:'fresh-cache',
        nextCheckAt:observedAt + freshness
      };
    }
    return { required:true, reason:'stale', nextCheckAt:now };
  }

  function fromTornResponse(playerId, response = {}, now = Date.now()) {
    const profile = response?.profile || response?.basic || response?.user || response;
    const status = profile?.status || {};
    const bounties = Array.isArray(profile?.bounties) ? profile.bounties : [];
    return normalizeRecord({
      playerId,
      name:profile?.name,
      level:profile?.level,
      state:status?.state,
      until:status?.until,
      description:status?.description,
      bountyCount:bounties.length,
      bountyTotal:bounties.reduce(
        (total, bounty) => total + Math.max(0, Number(bounty?.reward) || 0),
        0
      ),
      source:'torn-api',
      observedAt:now,
      checkedAt:now
    });
  }

  SLINK.define('core', 'playerIntelligence', Object.freeze({
    DEFAULT_FRESH_MS,
    TIMER_BUFFER_MS,
    TIMED_STATES,
    effectiveStatus,
    fromTornResponse,
    mergeRecord,
    normalizeRecord,
    normalizeState,
    normalizeUntil,
    requestDecision,
    untilMilliseconds,
    validPlayerId
  }));
})(globalThis);
