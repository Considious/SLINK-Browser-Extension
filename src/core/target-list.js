(function installTargetListCore(global) {
  'use strict';

  const SLINK = global.SLINK_EXTENSION;
  if (!SLINK) throw new Error('SLINK runtime must load before Target List.');

  const DEFAULT_TAGS = Object.freeze(['Level', 'Mug', 'War', 'Target']);
  const TAG_LIMIT = 16;
  const NOTE_LIMIT = 500;
  const STAKEOUT_DEFAULT_SECONDS = 10;
  const STAKEOUT_MIN_SECONDS = 10;
  const STAKEOUT_MAX_SECONDS = 3600;

  function normalizeStakeoutInterval(value) {
    return Math.max(
      STAKEOUT_MIN_SECONDS,
      Math.min(STAKEOUT_MAX_SECONDS, Math.trunc(Number(value) || STAKEOUT_DEFAULT_SECONDS))
    );
  }

  function validPlayerId(value) {
    const parsed = Number(value);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
  }

  function normalizeTag(value) {
    const text = String(value || '').trim().replace(/\s+/g, ' ').slice(0, 32);
    if (!text) return '';
    const known = DEFAULT_TAGS.find(tag => tag.toLowerCase() === text.toLowerCase());
    return known || text;
  }

  function normalizeTags(values) {
    const tags = [];
    const seen = new Set();
    for (const value of Array.isArray(values) ? values : [values]) {
      const tag = normalizeTag(value);
      const key = tag.toLowerCase();
      if (!tag || seen.has(key)) continue;
      seen.add(key);
      tags.push(tag);
      if (tags.length >= TAG_LIMIT) break;
    }
    return tags;
  }

  function safeContext(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
    const result = {};
    for (const [key, item] of Object.entries(value)) {
      if (!/^[a-z0-9_.-]{1,40}$/i.test(key)) continue;
      if (['string', 'number', 'boolean'].includes(typeof item) || item === null) {
        result[key] = typeof item === 'string' ? item.slice(0, 200) : item;
      }
    }
    return result;
  }

  function normalizeSource(input = {}, now = Date.now()) {
    const source = String(input.source || input.id || 'manual').trim().slice(0, 40) || 'manual';
    return {
      source,
      label:String(input.label || source).trim().slice(0, 60) || source,
      addedAt:Math.max(0, Number(input.addedAt) || now),
      updatedAt:Math.max(0, Number(input.updatedAt) || now),
      context:safeContext(input.context)
    };
  }

  function mergeSources(existing = [], incoming = [], now = Date.now()) {
    const bySource = new Map();
    for (const value of Array.isArray(existing) ? existing : []) {
      const source = normalizeSource(value, now);
      bySource.set(source.source.toLowerCase(), source);
    }
    for (const value of Array.isArray(incoming) ? incoming : []) {
      const source = normalizeSource(value, now);
      const key = source.source.toLowerCase();
      const previous = bySource.get(key);
      bySource.set(key, previous ? {
        ...previous,
        ...source,
        addedAt:Math.min(previous.addedAt, source.addedAt),
        updatedAt:Math.max(previous.updatedAt, source.updatedAt),
        context:{ ...previous.context, ...source.context }
      } : source);
    }
    return [...bySource.values()].sort((a, b) => a.addedAt - b.addedAt || a.source.localeCompare(b.source));
  }

  function sourceInputs(input = {}, now = Date.now()) {
    const sources = Array.isArray(input.sources) ? [...input.sources] : [];
    if (input.source || !sources.length) {
      sources.push({
        source:input.source || 'manual',
        label:input.sourceLabel || input.source || 'Manual',
        context:input.sourceContext || input.context,
        addedAt:input.sourceAddedAt || now,
        updatedAt:now
      });
    }
    return sources;
  }

  function normalizeTarget(input = {}, existing = {}) {
    const playerId = validPlayerId(
      input.playerId ?? input.player_id ?? input.targetId ?? input.id ??
      existing.playerId ?? existing.id
    );
    if (!playerId) throw new Error('A valid Torn player ID is required.');
    const now = Math.max(0, Number(input.updatedAt) || Date.now());
    const createdAt = Math.max(0, Number(input.createdAt ?? existing.createdAt) || now);
    return {
      playerId,
      id:playerId,
      name:String(input.name ?? existing.name ?? `Player ${playerId}`).trim().slice(0, 80) || `Player ${playerId}`,
      tags:normalizeTags(input.tags ?? existing.tags ?? ['Target']),
      description:String(input.description ?? input.notes ?? existing.description ?? '').trim().slice(0, NOTE_LIMIT),
      stakeout:Object.hasOwn(input, 'stakeout') ? input.stakeout === true : existing.stakeout === true,
      stakeoutIntervalSeconds:normalizeStakeoutInterval(
        input.stakeoutIntervalSeconds ?? input.stakeout_interval_seconds ??
        existing.stakeoutIntervalSeconds
      ),
      createdAt,
      updatedAt:Math.max(createdAt, now),
      sources:mergeSources(existing.sources, sourceInputs(input, now), now)
    };
  }

  function mergeTarget(existing = null, incoming = {}) {
    if (!existing) return normalizeTarget(incoming);
    const previous = normalizeTarget(existing);
    const next = normalizeTarget(incoming, previous);
    const hasOwn = key => Object.prototype.hasOwnProperty.call(incoming, key);
    return {
      ...previous,
      playerId:next.playerId,
      id:next.playerId,
      name:next.name !== `Player ${next.playerId}` || !previous.name ? next.name : previous.name,
      tags:normalizeTags([...previous.tags, ...next.tags]),
      description:hasOwn('description') || hasOwn('notes') ? next.description : previous.description,
      stakeout:next.stakeout,
      stakeoutIntervalSeconds:next.stakeoutIntervalSeconds,
      createdAt:Math.min(previous.createdAt, next.createdAt),
      updatedAt:Math.max(previous.updatedAt, next.updatedAt),
      sources:mergeSources(previous.sources, next.sources, next.updatedAt)
    };
  }

  function updateTarget(existing, patch = {}) {
    if (!existing) throw new Error('The saved target was not found.');
    const merged = mergeTarget(existing, patch);
    if (Object.prototype.hasOwnProperty.call(patch, 'tags')) {
      merged.tags = normalizeTags(patch.tags);
    }
    if (!merged.tags.length) merged.tags = ['Target'];
    return merged;
  }

  function enrichTarget(target, intelligence = null) {
    const record = intelligence && typeof intelligence === 'object' ? intelligence : null;
    return {
      ...normalizeTarget(target),
      intelligence:record,
      status:record?.status || null,
      lastChecked:Math.max(0, Number(record?.checkedAt || record?.observedAt) || 0),
      lastSeenMugged:Math.max(0, Number(record?.lastSeenMugged) || 0),
      bountyCount:Math.max(0, Math.trunc(Number(record?.bountyCount) || 0)),
      bountyTotal:Math.max(0, Number(record?.bountyTotal) || 0),
      fairFight:Number.isFinite(Number(record?.fairFight)) ? Number(record.fairFight) : null,
      battleStatsEstimate:Number.isFinite(Number(record?.battleStatsEstimate)) ? Number(record.battleStatsEstimate) : null
    };
  }

  SLINK.define('core', 'targetList', Object.freeze({
    DEFAULT_TAGS,
    STAKEOUT_DEFAULT_SECONDS,
    STAKEOUT_MIN_SECONDS,
    STAKEOUT_MAX_SECONDS,
    enrichTarget,
    mergeSources,
    mergeTarget,
    normalizeSource,
    normalizeStakeoutInterval,
    normalizeTag,
    normalizeTags,
    normalizeTarget,
    updateTarget,
    validPlayerId
  }));
})(globalThis);
