(function installBounties(global) {
  'use strict';

  const SLINK = global.SLINK_EXTENSION;
  if (!SLINK) throw new Error('SLINK runtime must load before Bounties helpers.');

  const ACTIVE_GRACE_MS = 5 * 60 * 1000;
  const FF_CACHE_MS = 7 * 24 * 60 * 60 * 1000;
  const MAX_FF_TARGETS = 205;

  function clamp(value, minimum, maximum, fallback = minimum) {
    const parsed = Number(value);
    return Math.min(maximum, Math.max(minimum, Number.isFinite(parsed) ? parsed : fallback));
  }

  function defaultSettings() {
    return {
      enabled:false,
      minimumReward:300_000,
      scanFullList:false,
      minFF:1,
      maxFF:3,
      maxBattleStats:0,
      includeUnknownEstimates:false,
      includeAbroad:false,
      statusFilter:'hide-hospital',
      tornCallsPerMinute:20,
      ffBatchesPerMinute:5,
      tornKey:'',
      ffKey:''
    };
  }

  function normalizeSettings(value = {}) {
    const source = value && typeof value === 'object' ? value : {};
    const statusFilter = ['all', 'okay', 'hospital', 'hide-hospital'].includes(String(source.statusFilter))
      ? String(source.statusFilter)
      : 'hide-hospital';
    return {
      enabled:source.enabled === true,
      minimumReward:Math.max(1, Math.trunc(Number(source.minimumReward) || 300_000)),
      scanFullList:source.scanFullList === true,
      minFF:clamp(source.minFF, 1, 3, 1),
      maxFF:clamp(source.maxFF, 1, 3, 3),
      maxBattleStats:Math.max(0, Math.trunc(Number(source.maxBattleStats) || 0)),
      includeUnknownEstimates:source.includeUnknownEstimates === true,
      includeAbroad:source.includeAbroad === true,
      statusFilter,
      tornCallsPerMinute:Math.trunc(clamp(source.tornCallsPerMinute, 1, 20, 20)),
      ffBatchesPerMinute:Math.trunc(clamp(source.ffBatchesPerMinute, 1, 20, 5)),
      tornKey:String(source.tornKey || '').trim(),
      ffKey:String(source.ffKey || '').trim()
    };
  }

  function validTargetId(value) {
    const parsed = Number(value);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
  }

  function mergeTargets(existing = [], rows = []) {
    const targets = new Map();
    for (const target of Array.isArray(existing) ? existing : []) {
      const id = validTargetId(target?.id ?? target?.target_id);
      if (!id) continue;
      targets.set(id, {
        id,
        name:String(target.name || target.target_name || `Player ${id}`).slice(0, 80),
        level:Math.max(0, Number(target.level ?? target.target_level) || 0),
        highestReward:Math.max(0, Number(target.highestReward ?? target.reward) || 0),
        highestQuantity:Math.max(0, Number(target.highestQuantity ?? target.quantity) || 0),
        apiRows:Math.max(0, Number(target.apiRows) || 0),
        validUntil:Math.max(0, Number(target.validUntil ?? target.valid_until) || 0)
      });
    }
    for (const row of Array.isArray(rows) ? rows : []) {
      const id = validTargetId(row?.target_id ?? row?.id);
      const reward = Math.max(0, Number(row?.reward) || 0);
      if (!id || reward <= 0) continue;
      const quantity = Math.max(1, Number(row?.quantity) || 1);
      const previous = targets.get(id);
      if (!previous) {
        targets.set(id, {
          id,
          name:String(row?.target_name || row?.name || `Player ${id}`).slice(0, 80),
          level:Math.max(0, Number(row?.target_level ?? row?.level) || 0),
          highestReward:reward,
          highestQuantity:quantity,
          apiRows:1,
          validUntil:Math.max(0, Number(row?.valid_until) || 0)
        });
        continue;
      }
      previous.apiRows += 1;
      if (reward > previous.highestReward) {
        previous.highestReward = reward;
        previous.highestQuantity = quantity;
      } else if (reward === previous.highestReward) {
        previous.highestQuantity += quantity;
      }
      previous.validUntil = Math.max(previous.validUntil, Number(row?.valid_until) || 0);
      if (!previous.name && row?.target_name) previous.name = String(row.target_name).slice(0, 80);
      if (!previous.level && row?.target_level) previous.level = Math.max(0, Number(row.target_level) || 0);
    }
    return [...targets.values()].sort((left, right) => right.highestReward - left.highestReward || left.id - right.id);
  }

  function normalizeState(value) {
    const lower = String(value || '').trim().toLowerCase();
    if (!lower) return 'Unknown';
    if (lower.includes('hospital')) return 'Hospital';
    if (lower.includes('federal')) return 'Federal';
    if (lower.includes('hiding')) return 'Hiding Out';
    if (lower.includes('travel') || lower.includes('flying')) return 'Traveling';
    if (lower.includes('abroad')) return 'Abroad';
    if (lower === 'okay' || lower === 'ok') return 'Okay';
    return String(value).trim().slice(0, 40) || 'Unknown';
  }

  function effectiveStatus(record, now = Date.now()) {
    const state = normalizeState(record?.state);
    const until = Math.max(0, Number(record?.until) || 0);
    if (state === 'Hospital' && until > 0 && until * 1000 <= now) {
      return { state:'Okay', label:'Presumed Okay', until:0, presumed:true, source:String(record?.source || '') };
    }
    return { state, label:state, until, presumed:false, source:String(record?.source || '') };
  }

  function isAbroadState(state) {
    return ['Abroad', 'Traveling', 'Hiding Out'].includes(normalizeState(state));
  }

  function filteredCandidates(targets, fairFightCache = {}, statusCache = {}, inputSettings = {}, now = Date.now()) {
    const settings = normalizeSettings(inputSettings);
    const minimumFF = Math.min(settings.minFF, settings.maxFF);
    const maximumFF = Math.max(settings.minFF, settings.maxFF);
    return (Array.isArray(targets) ? targets : []).map(target => {
      const estimate = fairFightCache[String(target.id)] || fairFightCache[target.id] || {};
      const fairFight = Number(estimate.fairFight);
      const bsEstimate = Number(estimate.bsEstimate);
      const hasEstimate = Number.isFinite(fairFight) && fairFight > 0 && Number.isFinite(bsEstimate) && bsEstimate > 0;
      const status = effectiveStatus(statusCache[String(target.id)] || statusCache[target.id], now);
      return {
        ...target,
        fairFight:hasEstimate ? fairFight : null,
        bsEstimate:hasEstimate ? bsEstimate : null,
        estimateSource:String(estimate.source || ''),
        estimateCheckedAt:Number(estimate.checkedAt) || 0,
        status
      };
    }).filter(target => {
      if (target.highestReward < settings.minimumReward && !settings.scanFullList) return false;
      if (target.fairFight === null || target.bsEstimate === null) {
        if (!settings.includeUnknownEstimates) return false;
      } else {
        if (target.fairFight < minimumFF || target.fairFight > maximumFF) return false;
        if (settings.maxBattleStats > 0 && target.bsEstimate > settings.maxBattleStats) return false;
      }
      if (!settings.includeAbroad && isAbroadState(target.status.state)) return false;
      if (settings.statusFilter === 'okay' && target.status.state !== 'Okay') return false;
      if (settings.statusFilter === 'hospital' && target.status.state !== 'Hospital') return false;
      if (settings.statusFilter === 'hide-hospital' && target.status.state === 'Hospital') return false;
      return target.status.state !== 'Federal';
    }).sort((left, right) => right.highestReward - left.highestReward || (right.fairFight || 0) - (left.fairFight || 0));
  }

  SLINK.define('core', 'bounties', Object.freeze({
    ACTIVE_GRACE_MS,
    FF_CACHE_MS,
    MAX_FF_TARGETS,
    defaultSettings,
    effectiveStatus,
    filteredCandidates,
    isAbroadState,
    mergeTargets,
    normalizeSettings,
    normalizeState,
    validTargetId
  }));
})(globalThis);

