(function installEventsCore(global) {
  'use strict';

  const SLINK = global.SLINK_EXTENSION;
  if (!SLINK) throw new Error('SLINK runtime must load before Events.');

  const SCOPE = 'slink.qol.events';
  const CACHE_MS = 6 * 60 * 60_000;
  const CALENDAR_URL = 'https://www.torn.com/calendar.php';
  const HALLOWEEN_GUIDE_URL = 'https://www.torn.com/forums.php?p=threads&f=61&t=16192843&b=0&a=0';
  const HALLOWEEN_GUIDE_EVENT = Object.freeze({
    id:'guide:halloween',
    name:'Halloween',
    startAt:0,
    endAt:0,
    description:'Preparation guide available year-round.',
    personalized:false,
    state:'unscheduled',
    guideId:'halloween',
    guideOnly:true
  });
  const HALLOWEEN_BASKET_RANKS = Object.freeze(['Spooky','Creepy','Freaky','Frightful','Haunting','Shocking','Terrifying','Horrifying','Petrifying','Nightmarish','Apocalyptic']);
  const HALLOWEEN_UPGRADE_ORDER = Object.freeze([
    { step:1, upgradeId:1, name:'I See Dead People', cost:3 },
    { step:2, upgradeId:2, name:"Here's Johnny", cost:5 },
    { step:3, upgradeId:3, name:'Doubler', cost:25 },
    { step:4, upgradeId:4, name:'Tripler', cost:50 },
    { step:5, upgradeId:5, name:'Quadrupler', cost:75 },
    { step:6, upgradeId:13, name:'Cat in Hell', cost:13 },
    { step:7, upgradeId:6, name:'Quintupler', cost:100 },
    { step:8, upgradeId:23, name:'Shadow of Doubt', cost:1000, note:'Awards 1,100 treats and advances basket progress.' },
    { step:9, upgradeId:19, name:'Multipack', cost:180 },
    { step:10, upgradeId:20, name:'Deal with the Devil', cost:320 },
    { step:11, upgradeId:18, name:'Dark Power', cost:285 },
    { step:12, upgradeId:15, name:'Freebie', cost:120 },
    { step:13, upgradeId:9, name:'Bloody Mary', cost:15 },
    { step:14, upgradeId:10, name:'Nice Chianti', cost:30 },
    { step:15, upgradeId:11, name:'Nightcrawler', cost:45 },
    { step:16, upgradeId:12, name:"It's Alive", cost:90 },
    { step:17, upgradeId:17, name:'Cashback', cost:230 },
    { step:18, upgradeId:7, name:'Candyman', cost:5 },
    { step:19, upgradeId:8, name:'Sweet Release', cost:10 },
    { step:20, upgradeId:16, name:'Cold Sweat', cost:170, optional:true, note:'The guide marks this final step as optional.' }
  ].map(entry => Object.freeze(entry)));
  const HALLOWEEN_SKIPPED_UPGRADES = Object.freeze([
    Object.freeze({ upgradeId:14, name:'Save Your Tears', reason:'Skip in the normal guide path.' }),
    Object.freeze({ upgradeId:21, name:'Mortal Coil', reason:"Only recommended for the M'aol path." }),
    Object.freeze({ upgradeId:22, name:'Inflation', reason:"Only recommended for the M'aol path." }),
    Object.freeze({ upgradeId:24, name:'Summon Him', reason:"Only for players intentionally summoning M'aol." })
  ]);
  const HALLOWEEN_RELICS = Object.freeze([
    Object.freeze({ name:"M'aol Tentacle", effect:'Doubles energy and nerve capacity and regeneration.' }),
    Object.freeze({ name:'Nol Cloachra', effect:'Consumables can be used without being consumed.' }),
    Object.freeze({ name:'Ladso Eye', effect:'Allows books to be read repeatedly.' }),
    Object.freeze({ name:'Asmol Knuckle', effect:'Provides a passive +100% damage bonus.' }),
    Object.freeze({ name:'Sylo Tooth', effect:'Provides +25% additive critical-hit chance.' }),
    Object.freeze({ name:'Dyno Sac', effect:'Removes negative drug effects, including addiction.' })
  ]);

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
    if (!events.some(event => isHalloweenEvent(event))) events.push({ ...HALLOWEEN_GUIDE_EVENT });
    for (const event of events) {
      if (isHalloweenEvent(event)) event.guideId = 'halloween';
    }
    const next = events.find(event => !event.guideOnly && event.state === 'active')
      || events.find(event => !event.guideOnly && event.state === 'upcoming')
      || events.find(event => !event.guideOnly)
      || events[0]
      || null;
    return { at:now, events, nextId:next?.id || '', next };
  }

  function selectEvent(calendar = {}, selectedId = '') {
    return calendar.events?.find(event => event.id === selectedId)
      || calendar.events?.find(event => event.id === calendar.nextId)
      || calendar.events?.[0]
      || null;
  }

  function halloweenBasketRank(value) {
    const text = plainText(value);
    if (!/Halloween Basket/i.test(text)) return '';
    return HALLOWEEN_BASKET_RANKS.find(rank => new RegExp(`(?:^|\\W)${rank}(?:$|\\W)`, 'i').test(text)) || '';
  }

  function normalizeHalloweenUpgradeStates(records = []) {
    const states = new Map();
    for (const record of records) {
      const upgradeId = Number(record?.upgradeId ?? record?.id);
      if (!Number.isInteger(upgradeId) || upgradeId < 1) continue;
      states.set(upgradeId, {
        upgradeId,
        name:plainText(record?.name || ''),
        unlocked:record?.unlocked === true,
        disabled:record?.disabled === true
      });
    }
    return states;
  }

  function halloweenRecommendations(records = [], limit = 3) {
    const states = normalizeHalloweenUpgradeStates(records);
    const remaining = HALLOWEEN_UPGRADE_ORDER.filter(upgrade => !states.get(upgrade.upgradeId)?.unlocked);
    const recommendations = remaining.slice(0, Math.max(1, Number(limit) || 3)).map((upgrade, index) => {
      const state = states.get(upgrade.upgradeId);
      return { ...upgrade, unlocked:false, disabled:state?.disabled === true, current:index === 0 };
    });
    return {
      complete:remaining.length === 0,
      completedCount:HALLOWEEN_UPGRADE_ORDER.length - remaining.length,
      total:HALLOWEEN_UPGRADE_ORDER.length,
      recommendations
    };
  }

  function isHalloweenEvent(event) {
    return /halloween|halloweek|trick\s*or\s*treat/i.test(String(event?.name || event?.id || ''));
  }

  SLINK.define('core', 'events', Object.freeze({
    SCOPE,
    CACHE_MS,
    CALENDAR_URL,
    HALLOWEEN_GUIDE_URL,
    HALLOWEEN_GUIDE_EVENT,
    HALLOWEEN_BASKET_RANKS,
    HALLOWEEN_UPGRADE_ORDER,
    HALLOWEEN_SKIPPED_UPGRADES,
    HALLOWEEN_RELICS,
    eventRows,
    halloweenBasketRank,
    halloweenRecommendations,
    isHalloweenEvent,
    mergeCalendars,
    normalizeHalloweenUpgradeStates,
    plainText,
    selectEvent,
    timestampMs
  }));
})(globalThis);

