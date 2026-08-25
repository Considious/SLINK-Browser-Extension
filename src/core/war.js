(function installWarCore(global) {
  'use strict';

  const SLINK = global.SLINK_EXTENSION;
  if (!SLINK) throw new Error('SLINK runtime must load before War helpers.');

  const WORKER_BASE = 'https://slinkwarworker.richard-johnson554.workers.dev';
  const TERMS_VERSION = '2026-08-24';
  const TERMS_SHA256 = '72a933d69ec99cabeb92b426208e9d0c47e90acaf960818e0b4da38f3f2f5b0a';

  function positiveInteger(value) {
    const number = Number(value);
    return Number.isInteger(number) && number > 0 ? number : 0;
  }

  function makeWarId(ownFactionId, opponentFactionId, startedAt) {
    const own = positiveInteger(ownFactionId);
    const opponent = positiveInteger(opponentFactionId);
    const rawStart = Math.max(0, Number(startedAt) || Date.now());
    const start = Math.floor(rawStart > 10_000_000_000 ? rawStart / 1000 : rawStart);
    if (!own || !opponent || own === opponent) return '';
    return `rw_${own}_${opponent}_${start}`;
  }

  function normalizeMember(member) {
    const id = positiveInteger(member?.id);
    if (!id) return null;
    return {
      id,
      name: String(member?.name || `Player ${id}`),
      level: Math.max(0, Number(member?.level) || 0),
      activity: String(member?.activity || 'Unknown'),
      lastActionTimestamp: Math.max(0, Number(member?.lastActionTimestamp) || 0),
      lastActionRelative: String(member?.lastActionRelative || ''),
      statusState: String(member?.statusState || ''),
      statusDescription: String(member?.statusDescription || ''),
      statusUntil: Math.max(0, Number(member?.statusUntil) || 0),
      position: String(member?.position || ''),
      fairFight:Number.isFinite(Number(member?.fairFight ?? member?.fair_fight)) ? Number(member?.fairFight ?? member?.fair_fight) : null,
      battleStatsEstimate:Number.isFinite(Number(member?.battleStatsEstimate ?? member?.battle_stats_estimate ?? member?.bs_estimate)) ? Number(member?.battleStatsEstimate ?? member?.battle_stats_estimate ?? member?.bs_estimate) : null
    };
  }

  function tctTime(unixSeconds) {
    if (!Number.isFinite(Number(unixSeconds)) || Number(unixSeconds) <= 0) return '';
    return new Date(Number(unixSeconds) * 1000).toLocaleTimeString('en-GB', {
      timeZone:'UTC', hour12:false, hour:'2-digit', minute:'2-digit', second:'2-digit'
    });
  }

  function statusEmoji(member) {
    if (member?.activity === 'Online') return '🟢';
    if (member?.activity === 'Idle') return '🟡';
    if (member?.activity === 'Offline') return '⚪';
    return '⚫';
  }

  function factionCallout(value) {
    const member = normalizeMember(value);
    if (!member) return '';
    const escape = SLINK.core.format.escapeHtml;
    const profile = `https://www.torn.com/profiles.php?XID=${member.id}`;
    const attack = `https://www.torn.com/loader2.php?sid=getInAttack&user2ID=${member.id}`;
    const details = [
      `<a href="${attack}">Attack</a>`,
      `Status: ${escape(member.statusState || 'Okay')} / ${escape(member.activity)}`
    ];
    if (isHospitalized(member)) {
      const readyAt = tctTime(member.statusUntil);
      details.push(`Hospital: ${SLINK.core.format.formatHumanDuration(statusSeconds(member))}${readyAt ? ` / ready ${readyAt} TCT` : ''}`);
    }
    if (Number.isFinite(member.battleStatsEstimate)) details.push(`Estimated BS: ${SLINK.core.format.shortNumber(member.battleStatsEstimate)}`);
    if (Number.isFinite(member.fairFight)) details.push(`FF: ${member.fairFight.toFixed(2)}`);
    if (member.lastActionRelative) details.push(`Last action: ${escape(member.lastActionRelative)}`);
    return `${statusEmoji(member)} <a href="${profile}">${escape(member.name)} [${member.id}]</a> - ${details.join(' - ')}`;
  }

  function isHospitalized(member) {
    return /hospital/i.test(String(member?.statusState || ''));
  }

  function isTraveling(member) {
    return /travel|abroad|returning to/i.test(`${member?.statusState || ''} ${member?.statusDescription || ''}`);
  }

  function statusSeconds(member, now = Date.now()) {
    return Math.max(0, Number(member?.statusUntil) - Math.floor(now / 1000));
  }

  function sortMembers(values, now = Date.now(), sortMode = 'availability') {
    const activityRank = { Online:0, Idle:1, Offline:2, Unknown:3 };
    return (Array.isArray(values) ? values : [])
      .map(normalizeMember)
      .filter(Boolean)
      .sort((a, b) => {
        if (sortMode === 'fairFightAsc' || sortMode === 'fairFightDesc') {
          const direction = sortMode === 'fairFightAsc' ? 1 : -1;
          const aKnown = Number.isFinite(a.fairFight);
          const bKnown = Number.isFinite(b.fairFight);
          if (aKnown !== bKnown) return aKnown ? -1 : 1;
          const fairFight = aKnown ? (a.fairFight - b.fairFight) * direction : 0;
          if (fairFight) return fairFight;
        }
        const aHospital = isHospitalized(a);
        const bHospital = isHospitalized(b);
        if (aHospital !== bHospital) return aHospital ? 1 : -1;
        if (aHospital && bHospital) return statusSeconds(a, now) - statusSeconds(b, now);
        const activity = (activityRank[a.activity] ?? 4) - (activityRank[b.activity] ?? 4);
        return activity || b.level - a.level || a.name.localeCompare(b.name);
      });
  }

  function summarizeLogs(payload) {
    const rows = [...(payload?.pending || []), ...(payload?.stored || [])];
    const byKey = new Map();
    for (const row of rows) {
      const key = `${row.attacker_id}:${row.defender_id}:${row.outcome}`;
      const current = byKey.get(key) || { ...row, event_count:0 };
      current.event_count += Number(row.event_count) || 0;
      current.first_seen_at = Math.min(
        Number(current.first_seen_at) || Number.POSITIVE_INFINITY,
        Number(row.first_seen_at) || Number.POSITIVE_INFINITY
      );
      current.last_seen_at = Math.max(Number(current.last_seen_at) || 0, Number(row.last_seen_at) || 0);
      byKey.set(key, current);
    }
    return [...byKey.values()].sort((a, b) => Number(b.last_seen_at) - Number(a.last_seen_at));
  }

  SLINK.define('core', 'war', Object.freeze({
    TERMS_SHA256,
    TERMS_VERSION,
    WORKER_BASE,
    factionCallout,
    isHospitalized,
    isTraveling,
    makeWarId,
    normalizeMember,
    positiveInteger,
    sortMembers,
    statusSeconds,
    tctTime,
    summarizeLogs
  }));
})(globalThis);
