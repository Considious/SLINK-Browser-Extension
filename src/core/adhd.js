(function installAdhdCore(global) {
  'use strict';

  const SLINK = global.SLINK_EXTENSION;
  if (!SLINK) throw new Error('SLINK runtime must load before ADHD helpers.');

  const DAY_MS = 24 * 60 * 60 * 1000;
  const ALERT_SCOPE = 'slink.adhd.alerts';
  const MARKET_SCOPE_PREFIX = 'slink.adhd.marketwatch.';
  const MARKET_TIERS = Object.freeze([5, 10, 15, 20]);
  const ARMORY_URL = 'https://www.torn.com/factions.php?step=your#/tab=armoury';
  const CITY_SHOP_TARGETS = Object.freeze([
    Object.freeze({ id:392, label:'Pepper Spray', shop:"Big Al's Gun Shop", href:'https://www.torn.com/bigalgunshop.php' }),
    Object.freeze({ id:731, label:'Empty Blood Bags', shop:'Pharmacy', href:'https://www.torn.com/shops.php?step=pharmacy' }),
    Object.freeze({ id:10, label:'Chainsaws', shop:"Big Al's Gun Shop", href:'https://www.torn.com/bigalgunshop.php' }),
    Object.freeze({ id:180, label:'Beer', shop:"Bits 'n' Bobs", href:'https://www.torn.com/shops.php?step=bitsnbobs' }),
    Object.freeze({ id:310, label:'Lollipops', shop:"Sally's Sweet Shop", href:'https://www.torn.com/shops.php?step=candy' }),
    Object.freeze({ id:956, label:'Blank DVDs', shop:'Cyber Force', href:'https://www.torn.com/shops.php?step=cyberforce' })
  ]);
  const ALERT_DEFINITIONS = Object.freeze([
    Object.freeze({ id:'energyRefill', label:'Energy refill' }),
    Object.freeze({ id:'nerveRefill', label:'Nerve refill' }),
    Object.freeze({ id:'energyFull', label:'Energy full' }),
    Object.freeze({ id:'nerveFull', label:'Nerve full' }),
    Object.freeze({ id:'boosterCooldown', label:'Booster ready' }),
    Object.freeze({ id:'medicalCooldown', label:'Medical / blood bags' }),
    Object.freeze({ id:'drugCooldown', label:'Drug ready' }),
    Object.freeze({ id:'playerAddiction', label:'Player addiction' }),
    Object.freeze({ id:'missions', label:'Mission unfinished' }),
    Object.freeze({ id:'cityItem', label:'Buy 100 city items' }),
    Object.freeze({ id:'raceOrFly', label:'Race or fly' }),
    Object.freeze({ id:'landing', label:'Landing soon' }),
    Object.freeze({ id:'organizedCrime', label:'Join an OC' }),
    Object.freeze({ id:'education', label:'Start an education' }),
    Object.freeze({ id:'casinoTokens', label:'Spend casino tokens' }),
    Object.freeze({ id:'stockBenefits', label:'Stock benefits ready' }),
    Object.freeze({ id:'clusterRing', label:'Cluster Ring window' })
  ]);
  const ALL_ALERT_IDS = Object.freeze([
    ...ALERT_DEFINITIONS.map(definition => definition.id),
    ...CITY_SHOP_TARGETS.map(target => `cityStock:${target.id}`)
  ]);

  function utcDay(timestamp = Date.now()) {
    return Math.floor(Number(timestamp) / DAY_MS);
  }

  function nextUtcDay(timestamp = Date.now()) {
    return (utcDay(timestamp) + 1) * DAY_MS;
  }

  function finite(value) {
    if (value === null || value === undefined || value === '') return null;
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
  }

  function booleanValue(value) {
    if (typeof value === 'boolean') return value;
    if (value === 0 || value === 1) return Boolean(value);
    if (typeof value === 'string' && /^(?:true|false|0|1)$/i.test(value.trim())) return /^(?:true|1)$/i.test(value.trim());
    return null;
  }

  function defaultSettings() {
    return {
      medicalThresholdHours:3,
      boosterThresholdHours:3,
      landingLeadMinutes:5,
      playerAddictionThreshold:4,
      enabled:Object.fromEntries(ALL_ALERT_IDS.map(id => [id, true])),
      soundEnabled:Object.fromEntries(ALL_ALERT_IDS.map(id => [id, false])),
      soundChoice:'chime',
      customSoundDataUrl:'',
      openLinksInNewTab:false,
      cityStockAlerts:Object.fromEntries(CITY_SHOP_TARGETS.map(target => [target.id, false])),
      snoozedUntil:{},
      cityDoneDay:null
    };
  }

  function normalizeSettings(input = {}) {
    const defaults = defaultSettings();
    return {
      ...defaults,
      ...(input && typeof input === 'object' ? input : {}),
      medicalThresholdHours:Math.min(24, Math.max(1, Number(input?.medicalThresholdHours) || defaults.medicalThresholdHours)),
      boosterThresholdHours:Math.min(72, Math.max(0, Number(input?.boosterThresholdHours) || defaults.boosterThresholdHours)),
      landingLeadMinutes:Math.min(60, Math.max(1, Number(input?.landingLeadMinutes) || defaults.landingLeadMinutes)),
      playerAddictionThreshold:Math.min(100, Math.max(0, finite(input?.playerAddictionThreshold) ?? defaults.playerAddictionThreshold)),
      enabled:{ ...defaults.enabled, ...(input?.enabled && typeof input.enabled === 'object' ? input.enabled : {}) },
      soundEnabled:{ ...defaults.soundEnabled, ...(input?.soundEnabled && typeof input.soundEnabled === 'object' ? input.soundEnabled : {}) },
      soundChoice:['chime', 'bell', 'urgent', 'custom'].includes(String(input?.soundChoice || '')) ? String(input.soundChoice) : defaults.soundChoice,
      customSoundDataUrl:/^data:audio\//i.test(String(input?.customSoundDataUrl || '')) ? String(input.customSoundDataUrl) : '',
      openLinksInNewTab:input?.openLinksInNewTab === true,
      cityStockAlerts:{ ...defaults.cityStockAlerts, ...(input?.cityStockAlerts && typeof input.cityStockAlerts === 'object' ? input.cityStockAlerts : {}) },
      snoozedUntil:{ ...(input?.snoozedUntil && typeof input.snoozedUntil === 'object' ? input.snoozedUntil : {}) },
      cityDoneDay:Number.isInteger(Number(input?.cityDoneDay)) ? Number(input.cityDoneDay) : null
    };
  }

  function marketWatchLimit(permissions = {}) {
    if (SLINK.core.permissions.hasScope(permissions, 'admin.*')) return MARKET_TIERS.at(-1);
    const scopes = Array.isArray(permissions?.scopes) ? permissions.scopes : [];
    if (scopes.some(scope => scope === `${MARKET_SCOPE_PREFIX}*` || scope === 'slink.adhd.*')) return MARKET_TIERS.at(-1);
    return scopes.reduce((maximum, scope) => {
      const match = String(scope || '').match(/^slink\.adhd\.marketwatch\.(\d+)$/);
      const tier = match ? Number(match[1]) : 0;
      return MARKET_TIERS.includes(tier) ? Math.max(maximum, tier) : maximum;
    }, 0);
  }

  function personalStat(body, name) {
    const target = String(name || '').toLowerCase();
    const rows = Array.isArray(body?.personalstats) ? body.personalstats : [];
    const row = rows.find(entry => String(entry?.name || '').toLowerCase() === target);
    const direct = finite(row?.value);
    if (direct !== null) return direct;
    const visited = new Set();
    function search(value, depth = 0) {
      if (!value || typeof value !== 'object' || depth > 8 || visited.has(value)) return null;
      visited.add(value);
      const named = String(value?.name || '').toLowerCase() === target ? finite(value?.value) : null;
      if (named !== null) return named;
      const property = finite(value?.[target]);
      if (property !== null) return property;
      for (const child of Object.values(value)) {
        const found = search(child, depth + 1);
        if (found !== null) return found;
      }
      return null;
    }
    return search(body);
  }

  function refillUsed(refills, type) {
    if (!refills || typeof refills !== 'object') return null;
    const direct = refills[type];
    if (direct && typeof direct === 'object') {
      for (const value of [direct.used, direct.refill_used]) {
        const used = booleanValue(value);
        if (used !== null) return used;
      }
      for (const value of [direct.available, direct.refill_available]) {
        const available = booleanValue(value);
        if (available !== null) return !available;
      }
    }
    const used = booleanValue(direct);
    if (used !== null) return used;
    for (const value of [refills[`${type}_refill_used`], refills[`${type}RefillUsed`]]) {
      const candidate = booleanValue(value);
      if (candidate !== null) return candidate;
    }
    return null;
  }

  function countdown(seconds, fetchedAt, now) {
    const initial = finite(seconds);
    if (initial === null || initial < 0) return null;
    return Math.max(0, Math.ceil(initial - Math.max(0, now - Number(fetchedAt || now)) / 1000));
  }

  function cityProgress(snapshot = {}, settings = defaultSettings(), now = Date.now()) {
    const current = finite(snapshot.cityItemsBought);
    const baseline = finite(snapshot.cityItemsAtReset);
    const bought = current === null || baseline === null ? null : Math.max(0, current - baseline);
    const manuallyDone = Number(settings.cityDoneDay) === utcDay(now);
    return {
      bought,
      remaining:bought === null ? null : Math.max(0, 100 - bought),
      complete:manuallyDone || (bought !== null && bought >= 100),
      manuallyDone
    };
  }

  function activeMissions(missions) {
    const givers = Array.isArray(missions?.givers) ? missions.givers : Array.isArray(missions) ? missions : [];
    return givers.flatMap(giver => Array.isArray(giver?.contracts) ? giver.contracts : [])
      .filter(contract => /^accepted$/i.test(String(contract?.status || '')));
  }

  function cityShopTargetStock(body) {
    const found = new Map();
    const targetById = new Map(CITY_SHOP_TARGETS.map(target => [target.id, target]));
    for (const shop of Array.isArray(body?.cityshops) ? body.cityshops : []) {
      for (const item of Array.isArray(shop?.items) ? shop.items : []) {
        const target = targetById.get(Number(item?.id));
        if (!target || String(shop?.name || '').toLowerCase() !== target.shop.toLowerCase()) continue;
        const current = finite(item?.stock?.current);
        const normal = finite(item?.stock?.default);
        found.set(target.id, {
          ...target,
          shopName:String(shop?.name || target.shop),
          price:Math.max(0, Number(item?.price) || 0),
          stock:current === null ? null : Math.max(0, Math.trunc(current)),
          defaultStock:normal === null ? null : Math.max(0, Math.trunc(normal))
        });
      }
    }
    return CITY_SHOP_TARGETS.map(target => found.get(target.id) || { ...target, stock:null, defaultStock:null, price:0 });
  }

  function raceActive(races, profileStatus = {}) {
    const rows = Array.isArray(races) ? races : [];
    const raceStates = rows.flatMap(race => [
      race?.status,
      race?.state,
      race?.status?.state,
      race?.status?.description,
      race?.description
    ]);
    const playerStates = [
      profileStatus?.state,
      profileStatus?.description,
      profileStatus?.details,
      typeof profileStatus === 'string' ? profileStatus : ''
    ];
    return [...raceStates, ...playerStates].some(value => {
      const text = String(value ?? '').trim();
      return /^(?:open|in[_ -]?progress|waiting|scheduled|pending)$/i.test(text)
        || /\bwaiting\s+for\s+(?:a\s+)?race\b/i.test(text)
        || /\b(?:currently\s+)?in\s+(?:a\s+)?race\b/i.test(text)
        || /\brace\s+(?:in[_ -]?progress|waiting|scheduled|pending)\b/i.test(text);
    });
  }

  function addictionPercentFromBattleStats(body) {
    const stats = body?.battlestats;
    const names = ['strength', 'defense', 'speed', 'dexterity'];
    if (!stats || !names.every(name => Array.isArray(stats[name]?.modifiers))) return null;
    const modifiers = names.flatMap(name => stats[name].modifiers
      .filter(modifier => /addiction/i.test(`${modifier?.effect || ''} ${modifier?.type || ''}`)));
    if (modifiers.some(modifier => finite(modifier?.value) === null)) return null;
    return modifiers.length ? Math.max(...modifiers.map(modifier => Math.abs(Number(modifier.value)))) : 0;
  }

  function stockBenefitsReady(stocks, catalog) {
    const rows = Array.isArray(stocks) ? stocks : [];
    const catalogRows = Array.isArray(catalog?.stocks) ? catalog.stocks : Array.isArray(catalog) ? catalog : [];
    const byId = new Map(catalogRows.map(stock => [Number(stock?.id), stock]));
    return rows.flatMap(stock => {
      const definition = byId.get(Number(stock?.id));
      if (stock?.bonus?.available !== true || definition?.bonus?.passive !== false) return [];
      return [{
        ...stock,
        name:String(definition?.name || '').trim(),
        acronym:String(definition?.acronym || '').trim(),
        benefitDescription:String(definition?.bonus?.description || '').trim()
      }];
    });
  }

  function chatAnchor(href, label) {
    const escape = SLINK.core.format.escapeHtml;
    return `<a href="${escape(href)}">${escape(label)}</a>`;
  }

  function clusterRingAchieved(crimes) {
    return (crimes?.crimes?.uniques || []).some(unique =>
      (unique?.rewards?.items || []).some(item => Number(item?.id ?? item?.item_id) === 1465));
  }

  function clusterRingReady(cluster) {
    if (!cluster || clusterRingAchieved(cluster.crimes)) return false;
    const skill = finite(cluster?.crimes?.crimes?.skill);
    if (skill !== null && skill < 100) return false;
    const subcrimes = cluster?.subcrimes?.subcrimes;
    const states = cluster?.status?.shoplifting;
    if (!Array.isArray(subcrimes) || !Array.isArray(states)) return false;
    const jewelry = subcrimes.find(row => /jewelry\s+store/i.test(String(row?.name || '')));
    const status = states.find(row => Number(row?.id) === Number(jewelry?.id))?.status;
    if (!Array.isArray(status)) return false;
    const camera = status.find(row => /camera/i.test(String(row?.title || '')));
    const guard = status.find(row => /guard/i.test(String(row?.title || '')));
    return camera?.disabled === true && guard?.disabled === true;
  }

  function buildAlerts(snapshot = {}, settingsInput = {}, now = Date.now(), options = {}) {
    const settings = normalizeSettings(settingsInput);
    const body = snapshot.data || {};
    const fetchedAt = Number(snapshot.fetchedAt) || now;
    const bars = body.bars || {};
    const cooldowns = body.cooldowns || {};
    const travel = body.travel || {};
    const profile = body.profile || {};
    const missions = activeMissions(body.missions);
    const education = body.education;
    const organizedCrime = body.organizedcrime ?? body.organizedCrime;
    const refills = body.refills || {};
    const casino = body.casino || {};
    const readyStocks = stockBenefitsReady(body.stocks, snapshot.stockCatalog);
    const playerAddiction = addictionPercentFromBattleStats(body);
    const travelSeconds = Number(travel?.arrival_at) * 1000 > now
      ? Math.ceil((Number(travel.arrival_at) * 1000 - now) / 1000)
      : countdown(travel?.time_left, fetchedAt, now);
    const drug = countdown(cooldowns.drug, fetchedAt, now);
    const medical = countdown(cooldowns.medical, fetchedAt, now);
    const booster = countdown(cooldowns.booster, fetchedAt, now);
    const progress = cityProgress(snapshot, settings, now);
    const cityStockAlerts = cityShopTargetStock(snapshot.cityShops)
      .filter(item => settings.cityStockAlerts[item.id] === true)
      .map(item => ({
        id:`cityStock:${item.id}`,
        active:!progress.complete && progress.bought !== null && Number(item.stock) > 0,
        title:`${item.label} in stock at ${item.shopName || item.shop}`,
        detail:`${Number(item.stock).toLocaleString()} available${item.defaultStock !== null ? ` (normal restock ${Number(item.defaultStock).toLocaleString()})` : ''}. ${progress.bought ?? 0} / 100 total city items bought today.`,
        tone:'urgent',
        links:[[item.shopName || item.shop, item.href]],
        shareText:`City Stock | ${SLINK.core.format.escapeHtml(item.label)} | ${Number(item.stock).toLocaleString()} available at ${SLINK.core.format.escapeHtml(item.shopName || item.shop)}${Number(item.price) > 0 ? ` | $${Number(item.price).toLocaleString()} each` : ''} | ${progress.bought ?? 0}/100 city items bought | ${chatAnchor(item.href, item.shopName || item.shop)}`
      }));
    const away = ['traveling', 'abroad'].includes(String(profile?.status?.state || '').toLowerCase()) || Number(travelSeconds) > 0;
    const activeRace = raceActive(body.races, profile.status);
    const racewayKnown = Array.isArray(body.enlistedcars) || Array.isArray(body.races);
    const alerts = [
      { id:'drugCooldown', active:drug === 0, title:'Drug cooldown is clear', detail:'You can take a drug now.', tone:'ready', links:[['Items','https://www.torn.com/item.php'],['Faction Armory',`${ARMORY_URL}&start=0&sub=drugs`]] },
      { id:'nerveFull', active:finite(bars?.nerve?.current) !== null && finite(bars?.nerve?.maximum) !== null && Number(bars.nerve.current) >= Number(bars.nerve.maximum), title:'Nerve is full', detail:`${bars?.nerve?.current ?? '?'} / ${bars?.nerve?.maximum ?? '?'}`, tone:'urgent', links:[['Crimes','https://www.torn.com/page.php?sid=crimes']] },
      { id:'energyFull', active:finite(bars?.energy?.current) !== null && finite(bars?.energy?.maximum) !== null && Number(bars.energy.current) >= Number(bars.energy.maximum), title:'Energy is full', detail:`${bars?.energy?.current ?? '?'} / ${bars?.energy?.maximum ?? '?'}`, tone:'urgent', links:[['Gym','https://www.torn.com/gym.php']] },
      { id:'medicalCooldown', active:medical !== null && medical <= settings.medicalThresholdHours * 3600, title:medical === 0 ? 'Medical cooldown is clear' : 'Medical cooldown is nearly clear', detail:medical === 0 ? 'Fill a blood bag or use medical supplies.' : `${SLINK.core.format.formatHumanDuration(medical)} remaining`, timerSeconds:medical, tone:'ready', links:[['Items','https://www.torn.com/item.php'],['Faction Armory',`${ARMORY_URL}&start=0&sub=medical`]] },
      { id:'boosterCooldown', active:booster !== null && booster <= settings.boosterThresholdHours * 3600, title:booster === 0 ? 'Booster cooldown is clear' : 'Booster cooldown is nearly clear', detail:booster === 0 ? 'You can use a booster now.' : `${SLINK.core.format.formatHumanDuration(booster)} remaining`, timerSeconds:booster, tone:'ready', links:[['Items','https://www.torn.com/item.php'],['Faction Armory',`${ARMORY_URL}&start=0&sub=boosters`]] },
      { id:'missions', active:missions.length > 0, title:missions.length >= 3 ? 'Mission cap reached — complete one' : missions.length === 1 ? 'Mission is unfinished' : `${missions.length} missions are unfinished`, detail:missions.length >= 3 ? 'You have three accepted missions. Complete one before another mission arrives so you do not miss mission credits.' : missions.slice(0, 2).map(item => item?.title).filter(Boolean).join(' / '), tone:missions.length >= 3 ? 'urgent' : 'daily', links:[['Missions','https://www.torn.com/page.php?sid=missions']] },
      { id:'cityItem', active:progress.bought !== null && !progress.complete, title:'Buy 100 items from city shops', detail:`${progress.bought} / 100 confirmed since reset — ${progress.remaining} remaining.`, tone:'daily', links:[['City','https://www.torn.com/city.php']] },
      { id:'raceOrFly', active:racewayKnown && !activeRace && !away, title:'Start a race or take a flight', detail:'You are on the ground and not entered in an active race.', tone:'daily', links:[['Raceway','https://www.torn.com/page.php?sid=racing'],['Travel','https://www.torn.com/travelagency.php']] },
      { id:'landing', active:Number(travelSeconds) > 0 && travelSeconds <= settings.landingLeadMinutes * 60, title:'Landing soon', detail:`${travel?.destination ? `Arriving in ${travel.destination} in ` : 'Landing in '}${SLINK.core.format.formatHumanDuration(travelSeconds)}`, timerSeconds:travelSeconds, tone:'landing', links:[['Travel','https://www.torn.com/index.php']] },
      { id:'organizedCrime', active:Number(profile?.faction_id || 0) > 0 && organizedCrime === null, title:'Join an organized crime', detail:'No current organized crime was returned for your faction membership.', tone:'daily', links:[['Faction crimes','https://www.torn.com/factions.php?step=your#/tab=crimes']] },
      { id:'education', active:Boolean(education) && education.current === null, title:'Start an education course', detail:'No active education course was returned.', tone:'daily', links:[['Education','https://www.torn.com/education.php']] },
      { id:'casinoTokens', active:Number(casino?.tokens) > 0, title:'Spend casino tokens', detail:`${Number(casino?.tokens || 0).toLocaleString()} token${Number(casino?.tokens) === 1 ? '' : 's'} available`, tone:'daily', links:[['Casino','https://www.torn.com/casino.php']] },
      { id:'energyRefill', active:refillUsed(refills, 'energy') === false, title:'Energy refill is unused', detail:'Your daily point refill is still available.', tone:'daily', links:[['Points','https://www.torn.com/points.php'],['Faction Armory',ARMORY_URL]] },
      { id:'nerveRefill', active:refillUsed(refills, 'nerve') === false, title:'Nerve refill is unused', detail:'Your daily point refill is still available.', tone:'daily', links:[['Points','https://www.torn.com/points.php'],['Faction Armory',ARMORY_URL]] },
      { id:'stockBenefits', active:readyStocks.length > 0, title:readyStocks.length === 1 ? 'A stock benefit is ready' : `${readyStocks.length} stock benefits are ready`, detail:readyStocks.map(stock => stock.name ? `${stock.name}${stock.acronym ? ` (${stock.acronym})` : ''}` : stock.acronym || `Stock ${stock.id}`).join(', '), tone:'ready', links:[['Stock market','https://www.torn.com/page.php?sid=stocks']] },
      { id:'playerAddiction', active:playerAddiction !== null && playerAddiction >= settings.playerAddictionThreshold, title:'Player addiction needs attention', detail:`${playerAddiction ?? 0}% battle-stat penalty — alert threshold ${settings.playerAddictionThreshold}%`, tone:'urgent', links:[['Travel','https://www.torn.com/travelagency.php']] },
      { id:'clusterRing', active:clusterRingReady(snapshot.cluster), title:'Cluster Ring security window is open', detail:'Torn reports the Jewelry Store cameras and guard are disabled. Shoplifting skill 100 and 0% Jewelry Store notoriety are still required.', tone:'urgent', links:[['Shoplift','https://www.torn.com/page.php?sid=crimes#/shoplifting']] },
      ...cityStockAlerts
    ];
    return alerts.filter(alert => alert.active
      && (options.includeHidden === true || settings.enabled[alert.id] !== false)
      && Number(settings.snoozedUntil[alert.id] || 0) <= now);
  }

  function nextRefreshAt(snapshot = {}, settingsInput = {}, now = Date.now()) {
    const settings = normalizeSettings(settingsInput);
    const body = snapshot.data || {};
    const fetchedAt = Number(snapshot.fetchedAt) || now;
    const candidates = [now + 2 * 60 * 60 * 1000, nextUtcDay(now) + 15_000];
    const progress = cityProgress(snapshot, settings, now);
    if (!progress.complete) candidates.push(now + 5 * 60_000);
    if ((settings.enabled.clusterRing !== false || settings.soundEnabled.clusterRing === true)
      && !clusterRingAchieved(snapshot?.cluster?.crimes)) candidates.push(now + 5 * 60_000);
    for (const [type, threshold] of [['drug', 0], ['medical', settings.medicalThresholdHours * 3600], ['booster', settings.boosterThresholdHours * 3600]]) {
      const remaining = countdown(body?.cooldowns?.[type], fetchedAt, now);
      if (remaining === null) candidates.push(now + 10 * 60_000);
      else if (remaining > threshold) candidates.push(now + (remaining - threshold) * 1000 + 5_000);
      else if (remaining > 0) candidates.push(now + remaining * 1000 + 5_000);
    }
    for (const bar of ['energy', 'nerve']) {
      const fullTime = finite(body?.bars?.[bar]?.full_time);
      if (fullTime && fullTime > 0) candidates.push(fullTime > 7 * 24 * 60 * 60 ? fullTime * 1000 + 5_000 : now + fullTime * 1000 + 5_000);
    }
    const arrival = finite(body?.travel?.arrival_at);
    if (arrival && arrival * 1000 > now) candidates.push(Math.max(now + 60_000, arrival * 1000 - settings.landingLeadMinutes * 60_000));
    return Math.max(now + 60_000, Math.min(...candidates.filter(Number.isFinite)));
  }

  async function playNotificationSound(input = {}) {
    const choice = String(input.soundChoice || 'chime');
    const custom = String(input.customSoundDataUrl || '');
    if (choice === 'custom') {
      if (!/^data:audio\//i.test(custom)) throw new Error('Upload a custom audio file before selecting Custom.');
      const audio = new Audio(custom);
      audio.volume = 0.8;
      await audio.play();
      return;
    }
    const AudioContextClass = global.AudioContext || global.webkitAudioContext;
    if (!AudioContextClass) throw new Error('Audio playback is unavailable in this browser context.');
    const context = new AudioContextClass();
    const patterns = {
      chime:[[0, 660, 0.13], [0.12, 880, 0.2]],
      bell:[[0, 880, 0.12], [0.17, 660, 0.15], [0.34, 880, 0.2]],
      urgent:[[0, 440, 0.14], [0.18, 440, 0.14], [0.36, 660, 0.22]]
    };
    const notes = patterns[choice] || patterns.chime;
    const start = context.currentTime + 0.02;
    for (const [offset, frequency, duration] of notes) {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = choice === 'urgent' ? 'square' : 'sine';
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(0.0001, start + offset);
      gain.gain.exponentialRampToValueAtTime(0.16, start + offset + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + offset + duration);
      oscillator.connect(gain); gain.connect(context.destination);
      oscillator.start(start + offset); oscillator.stop(start + offset + duration + 0.02);
    }
    global.setTimeout(() => { void context.close(); }, 1_500);
  }

  SLINK.define('core', 'adhd', Object.freeze({
    ALERT_DEFINITIONS,
    ALL_ALERT_IDS,
    ALERT_SCOPE,
    CITY_SHOP_TARGETS,
    DAY_MS,
    MARKET_SCOPE_PREFIX,
    MARKET_TIERS,
    buildAlerts,
    addictionPercentFromBattleStats,
    clusterRingAchieved,
    clusterRingReady,
    cityShopTargetStock,
    cityProgress,
    defaultSettings,
    marketWatchLimit,
    nextRefreshAt,
    nextUtcDay,
    normalizeSettings,
    personalStat,
    playNotificationSound,
    raceActive,
    refillUsed,
    stockBenefitsReady,
    utcDay
  }));
})(globalThis);
