(function installTravelSafety(global) {
  'use strict';

  const SLINK = global.SLINK_EXTENSION;
  if (!SLINK) throw new Error('SLINK runtime must load before travel safety.');

  const SCOPE = 'slink.qol.travel-safety';
  const BUFFER_RATIO = 0.10;
  const CACHE_MS = 2 * 60 * 1000;

  function finite(value) {
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
  }

  function timestampMs(value) {
    const number = finite(value);
    if (number === null || number <= 0) return 0;
    return number < 10_000_000_000 ? Math.trunc(number * 1000) : Math.trunc(number);
  }

  function parseDurationMs(value) {
    const text = String(value || '').trim();
    if (!text) return 0;
    let seconds = 0;
    let matched = false;
    const unitPattern = /(\d+(?:\.\d+)?)\s*(?:d(?:ays?)?|h(?:ours?)?|m(?:in(?:ute)?s?)?|s(?:ec(?:ond)?s?)?)(?![a-z])/gi;
    for (const match of text.matchAll(unitPattern)) {
      matched = true;
      const amount = Number(match[1]);
      const unit = match[0].replace(match[1], '').trim().toLowerCase()[0];
      seconds += amount * (unit === 'd' ? 86_400 : unit === 'h' ? 3_600 : unit === 'm' ? 60 : 1);
    }
    if (matched) return Math.round(seconds * 1000);
    const clock = text.match(/^(\d+):(\d{1,2}):(\d{2})$/);
    if (clock) return (Number(clock[1]) * 3_600 + Number(clock[2]) * 60 + Number(clock[3])) * 1000;
    const hourMinute = text.match(/^(\d{1,2}):(\d{2})$/);
    if (hourMinute) return (Number(hourMinute[1]) * 3_600 + Number(hourMinute[2]) * 60) * 1000;
    return 0;
  }

  function destinationFromLabel(value) {
    return String(value || '').trim().match(/^Travel\s+to\s+(.+)$/i)?.[1]?.trim() || '';
  }

  function travelButton(target) {
    return target?.closest?.('button[aria-label^="Travel to "]') || null;
  }

  function travelTimeElement(button) {
    if (!button?.parentElement) return null;
    let node = button.parentElement;
    for (let depth = 0; node && depth < 9; depth += 1, node = node.parentElement) {
      const buttons = [...node.querySelectorAll('button[aria-label^="Travel to "]')];
      if (buttons.length !== 1 || buttons[0] !== button) continue;
      const times = [...node.querySelectorAll('time')].filter(time => parseDurationMs(time.getAttribute('datetime') || time.textContent) > 0);
      if (times.length) return times[0];
    }
    return null;
  }

  function oneWayMsFromButton(button) {
    const time = travelTimeElement(button);
    if (!time) return 0;
    return parseDurationMs(time.getAttribute('datetime') || time.querySelector('[class*="srOnly"]')?.textContent || time.textContent);
  }

  function roundTripMs(oneWayMs, bufferRatio = BUFFER_RATIO) {
    const oneWay = Math.max(0, finite(oneWayMs) || 0);
    const buffer = Math.max(0, finite(bufferRatio) ?? BUFFER_RATIO);
    return Math.ceil(oneWay * 2 * (1 + buffer));
  }

  function normalizeCrime(response) {
    const wrapped = response?.organizedcrime ?? response?.organizedCrime ?? response?.crime ?? response;
    if (!wrapped || typeof wrapped !== 'object' || Array.isArray(wrapped)) return null;
    const readyAt = timestampMs(wrapped.ready_at ?? wrapped.readyAt);
    if (!readyAt) return null;
    return Object.freeze({
      id:String(wrapped.id ?? wrapped.crime_id ?? wrapped.crimeId ?? ''),
      name:String(wrapped.name ?? wrapped.title ?? 'Organized crime'),
      readyAt,
      executedAt:timestampMs(wrapped.executed_at ?? wrapped.executedAt),
      expiredAt:timestampMs(wrapped.expired_at ?? wrapped.expiredAt)
    });
  }

  function assessTrip({ oneWayMs, crime, now = Date.now(), bufferRatio = BUFFER_RATIO } = {}) {
    const departureAt = timestampMs(now) || Date.now();
    const journeyMs = roundTripMs(oneWayMs, bufferRatio);
    const readyAt = timestampMs(crime?.readyAt ?? crime?.ready_at);
    const returnAt = departureAt + journeyMs;
    const activeCrime = readyAt > departureAt && !timestampMs(crime?.executedAt ?? crime?.executed_at);
    return Object.freeze({
      blocked:Boolean(journeyMs && activeCrime && returnAt > readyAt),
      oneWayMs:Math.max(0, finite(oneWayMs) || 0),
      roundTripMs:journeyMs,
      departureAt,
      returnAt,
      readyAt,
      marginMs:readyAt ? readyAt - returnAt : 0
    });
  }

  function formatTct(timestamp) {
    const value = timestampMs(timestamp);
    if (!value) return 'unknown';
    return new Intl.DateTimeFormat('en-US', {
      timeZone:'UTC', month:'short', day:'numeric', hour:'2-digit', minute:'2-digit', hour12:false
    }).format(value) + ' TCT';
  }

  SLINK.define('core', 'travelSafety', Object.freeze({
    BUFFER_RATIO,
    CACHE_MS,
    SCOPE,
    assessTrip,
    destinationFromLabel,
    formatTct,
    normalizeCrime,
    oneWayMsFromButton,
    parseDurationMs,
    roundTripMs,
    timestampMs,
    travelButton,
    travelTimeElement
  }));
})(globalThis);

