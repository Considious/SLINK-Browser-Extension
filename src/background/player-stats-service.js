(function installPlayerStatsService(global) {
  'use strict';

  const SLINK = global.SLINK_EXTENSION;
  const CACHE_KEY = 'playerStats.daily.v1';
  const DAILY_ALARM = 'slink.playerStats.daily';
  const DAY_MS = 24 * 60 * 60 * 1000;
  const RESET_DELAY_MS = 5 * 60 * 1000;
  const STAT_NAMES = Object.freeze([
    'xantaken',
    'energydrinkused',
    'refills',
    'attackswon',
    'respectforfaction',
    'retals',
    'timeplayed',
    'networth'
  ]);
  const PERIODS = Object.freeze([1, 2, 7, 30]);

  let refreshPromise = null;

  function utcDayStart(timestamp = Date.now()) {
    return Math.floor(Number(timestamp) / DAY_MS) * DAY_MS;
  }

  function nextDailyRefresh(timestamp = Date.now()) {
    const today = utcDayStart(timestamp) + RESET_DELAY_MS;
    return today > timestamp ? today : today + DAY_MS;
  }

  function finite(value) {
    if (value === null || value === undefined || value === '') return null;
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
  }

  function delta(current, previous) {
    const now = finite(current);
    const before = finite(previous);
    return now === null || before === null ? null : now - before;
  }

  function statMap(response) {
    const rows = Array.isArray(response?.personalstats) ? response.personalstats : [];
    return Object.fromEntries(rows.map(row => [String(row?.name || ''), finite(row?.value)]).filter(([name, value]) => name && value !== null));
  }

  async function tornKey() {
    const [leveling, war] = await Promise.all([
      SLINK.core.storage.get('leveling.settings.v1', {}),
      SLINK.core.storage.get('war.settings.v1', {})
    ]);
    return String(leveling?.tornKey || war?.tornKey || '').trim();
  }

  async function tornJson(url, key) {
    await SLINK.core.tornApiLimiter.reserve({ wait:true });
    const response = await SLINK.core.http.requestJson('tornApi', url, {
      headers:{ Authorization:`ApiKey ${key}` },
      cache:'no-store'
    });
    if (response?.error) {
      const error = new Error(response.error.message || response.error.error || 'Torn API request failed.');
      error.code = 'SLINK_PLAYER_STATS_TORN_ERROR';
      throw error;
    }
    return response;
  }

  function personalStatsUrl(timestamp = null, combined = false) {
    const url = new URL(combined ? 'https://api.torn.com/v2/user' : 'https://api.torn.com/v2/user/personalstats');
    if (combined) url.searchParams.set('selections', 'personalstats,money,workstats');
    url.searchParams.set('stat', STAT_NAMES.join(','));
    if (timestamp !== null) url.searchParams.set('timestamp', String(Math.floor(timestamp / 1000)));
    url.searchParams.set('comment', 'SLINK daily player stats');
    return url.href;
  }

  function period(current, historic, days) {
    return {
      days,
      xanax:delta(current.xantaken, historic.xantaken),
      energyDrinks:delta(current.energydrinkused, historic.energydrinkused),
      refills:delta(current.refills, historic.refills),
      attacks:delta(current.attackswon, historic.attackswon),
      respect:delta(current.respectforfaction, historic.respectforfaction),
      retals:delta(current.retals, historic.retals),
      activitySeconds:delta(current.timeplayed, historic.timeplayed),
      networthChange:delta(current.networth, historic.networth)
    };
  }

  function buildStats(currentResponse, history, refreshedAt) {
    const current = statMap(currentResponse);
    const money = currentResponse?.money || {};
    const workstats = currentResponse?.workstats || {};
    const oneDay = history[1] || {};
    const twoDays = history[2] || {};
    return {
      refreshedAt,
      tornDay:Math.floor(utcDayStart(refreshedAt) / DAY_MS),
      note:'Torn historical personal stats update daily.',
      periods:{
        7:period(current, history[7] || {}, 7),
        30:period(current, history[30] || {}, 30)
      },
      networth:{
        current:finite(current.networth),
        yesterday:delta(current.networth, oneDay.networth),
        dayBeforeYesterday:delta(oneDay.networth, twoDays.networth),
        sevenDays:delta(current.networth, history[7]?.networth),
        thirtyDays:delta(current.networth, history[30]?.networth)
      },
      workstats:{
        manualLabor:finite(workstats.manual_labor),
        intelligence:finite(workstats.intelligence),
        endurance:finite(workstats.endurance),
        total:finite(workstats.total)
      },
      armoryBalance:finite(money.faction)
    };
  }

  async function refresh(force = false) {
    if (refreshPromise) return refreshPromise;
    refreshPromise = (async () => {
      const key = await tornKey();
      if (!key) {
        const error = new Error('Add your Torn API key under API and feature access to load player stats.');
        error.code = 'SLINK_TORN_KEY_REQUIRED';
        throw error;
      }
      const cached = await SLINK.core.storage.get(CACHE_KEY, null);
      const now = Date.now();
      const today = Math.floor(utcDayStart(now) / DAY_MS);
      if (!force && cached?.data?.tornDay === today && Number(cached?.data?.refreshedAt) >= utcDayStart(now)) return cached.data;

      const baseline = utcDayStart(now);
      const [currentResponse, ...historicResponses] = await Promise.all([
        tornJson(personalStatsUrl(null, true), key),
        ...PERIODS.map(days => tornJson(personalStatsUrl(baseline - days * DAY_MS), key))
      ]);
      const history = Object.fromEntries(PERIODS.map((days, index) => [days, statMap(historicResponses[index])]));
      const data = buildStats(currentResponse, history, now);
      await SLINK.core.storage.set(CACHE_KEY, { data });
      return data;
    })();
    try {
      return await refreshPromise;
    } finally {
      refreshPromise = null;
    }
  }

  async function status({ refreshIfStale = false } = {}) {
    const key = await tornKey();
    const cached = await SLINK.core.storage.get(CACHE_KEY, null);
    let data = cached?.data || null;
    let error = '';
    const now = Date.now();
    const refreshWindowOpen = now >= utcDayStart(now) + RESET_DELAY_MS;
    const stale = !data || (refreshWindowOpen && data.tornDay !== Math.floor(utcDayStart(now) / DAY_MS));
    if (refreshIfStale && key && stale) {
      try { data = await refresh(false); }
      catch (cause) { error = SLINK.core.format.errorMessage(cause); }
    }
    return {
      configured:Boolean(key),
      stale,
      error,
      data
    };
  }

  async function ensureAlarm() {
    const existing = await chrome.alarms.get(DAILY_ALARM);
    const next = nextDailyRefresh();
    if (!existing || Math.abs(Number(existing.scheduledTime) - next) > 60_000) {
      await chrome.alarms.create(DAILY_ALARM, { when:next, periodInMinutes:24 * 60 });
    }
    return chrome.alarms.get(DAILY_ALARM);
  }

  const routes = Object.freeze({
    async 'playerStats.status'(payload) {
      return status({ refreshIfStale:payload?.refreshIfStale !== false });
    },
    async 'playerStats.refresh'() {
      const data = await refresh(true);
      return { configured:true, stale:false, error:'', data };
    }
  });

  SLINK.define('services', 'playerStats', Object.freeze({
    ALARM:DAILY_ALARM,
    ensureAlarm,
    refresh,
    routes,
    status
  }));
})(globalThis);
