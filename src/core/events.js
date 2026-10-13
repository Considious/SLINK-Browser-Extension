(function installEventsCore(global) {
  'use strict';

  const SLINK = global.SLINK_EXTENSION;
  if (!SLINK) throw new Error('SLINK runtime must load before Events.');

  const SCOPE = 'slink.qol.events';
  const CACHE_MS = 6 * 60 * 60_000;
  const CALENDAR_URL = 'https://www.torn.com/calendar.php';

  function rows(value) {
    if (Array.isArray(value)) return value.map((entry, index) => ({ key:String(index), value:entry }));
    if (value && typeof value === 'object') return Object.entries(value).map(([key, entry]) => ({ key, value:entry }));
    return [];
  }

  function timestampMs(value) {
    if (value === null || value === undefined || value === '') return 0;
    const numeric = Number(value);
    if (Number.isFinite(numeric) && numeric > 0) return numeric < 10_000_000_000 ? Math.trunc(numeric * 1000) : Math.trunc(numeric);
    const parsed = Date.parse(String(value));
    return Number.isFinite(parsed) ? parsed : 0;
  }

  function plainText(value) {
    return String(value || '').replace(/<[^>]*>/g, ' ').replace(/&nbsp;/gi, ' ').replace(/&amp;/gi, '&').replace(/\s+/g, ' ').trim();
  }

  function eventRows(payload = {}) {
    const source = payload.calendar ?? payload.events ?? payload.competitions ?? payload;
    return rows(source).map(({ key, value }) => {
      if (value === null || value === undefined) return null;
      const item = typeof value === 'object' ? value : { start:value };
      const name = plainText(item.name ?? item.title ?? item.event ?? item.description ?? key);
      if (!name) return null;
      const startAt = timestampMs(item.start ?? item.start_time ?? item.starts_at ?? item.from ?? item.timestamp ?? item.time);
      const endAt = timestampMs(item.end ?? item.end_time ?? item.ends_at ?? item.to);
      return {
        id:String(item.id ?? item.event_id ?? item.slug ?? key ?? name).trim() || name,
        name,
        startAt,
        endAt,
        description:plainText(item.description ?? item.details ?? item.text ?? ''),
        fixedStartTime:item.fixed_start_time !== false,
        sourceKey:String(key)
      };
    }).filter(Boolean);
  }

  function identity(event) {
    return String(event.id || event.name || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
  }

  function mergeCalendars(tornPayload = {}, userPayload = {}, now = Date.now()) {
    const globalEvents = eventRows(tornPayload);
    const personalEvents = eventRows(userPayload);
    const personal = new Map();
    for (const event of personalEvents) {
      personal.set(identity(event), event);
      personal.set(String(event.name).toLowerCase(), event);
    }
    const source = globalEvents.length ? globalEvents : personalEvents;
    const events = source.map(event => {
      const override = personal.get(identity(event)) || personal.get(String(event.name).toLowerCase());
      const startAt = override?.startAt || event.startAt;
      const endAt = override?.endAt || event.endAt;
      const state = startAt && startAt <= now && (!endAt || endAt > now)
        ? 'active'
        : startAt > now ? 'upcoming'
        : endAt && endAt <= now ? 'past'
        : 'unscheduled';
      return {
        ...event,
        startAt,
        endAt,
        description:event.description || override?.description || '',
        personalized:Boolean(override?.startAt),
        state
      };
    }).sort((left, right) => {
      const rank = { active:0, upcoming:1, unscheduled:2, past:3 };
      return (rank[left.state] ?? 9) - (rank[right.state] ?? 9)
        || (left.startAt || Number.MAX_SAFE_INTEGER) - (right.startAt || Number.MAX_SAFE_INTEGER)
        || left.name.localeCompare(right.name);
    });
    const next = events.find(event => event.state === 'active') || events.find(event => event.state === 'upcoming') || events[0] || null;
    return { at:now, events, nextId:next?.id || '', next };
  }

  function selectEvent(calendar = {}, selectedId = '') {
    return calendar.events?.find(event => event.id === selectedId)
      || calendar.events?.find(event => event.id === calendar.nextId)
      || calendar.events?.[0]
      || null;
  }

  SLINK.define('core', 'events', Object.freeze({
    SCOPE,
    CACHE_MS,
    CALENDAR_URL,
    eventRows,
    mergeCalendars,
    plainText,
    selectEvent,
    timestampMs
  }));
})(globalThis);
