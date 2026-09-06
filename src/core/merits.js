(function installMeritsCore(global) {
  'use strict';

  const SLINK = global.SLINK_EXTENSION;
  if (!SLINK) throw new Error('SLINK runtime must load before Merit helpers.');

  const REQUIRED_SCOPE = SLINK.core.adhd.ALERT_SCOPE;
  const TRACK_LIMIT = 3;
  const DEFAULT_REFRESH_MINUTES = 15;
  const CATALOG_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
  const FINISHER_TARGET = 1_000;
  const PLAYER_RANKS = Object.freeze(['Beginner','Inexperienced','Rookie','Novice','Below Average','Average','Reasonable','Above Average','Competent','Highly Competent','Veteran','Distinguished','Highly Distinguished','Professional','Star','Master','Outstanding','Celebrity','Supreme','Idolized','Champion','Heroic','Legendary','Elite','Invincible']);
  const FINISHER_LABELS = Object.freeze({
    heavy_artillery:'Heavy artillery', machine_guns:'Machine guns', rifles:'Rifles',
    sub_machine_guns:'Sub-machine guns', shotguns:'Shotguns', pistols:'Pistols',
    temporary:'Temporary', piercing:'Piercing', slashing:'Slashing', clubbing:'Clubbing',
    mechanical:'Mechanical', hand_to_hand:'Hand-to-hand'
  });

  function defaultSettings() {
    return { refreshMinutes:DEFAULT_REFRESH_MINUTES, filter:'all', pinned:[] };
  }

  function normalizeSettings(input = {}) {
    const refreshMinutes = Math.min(120, Math.max(5, Math.round(Number(input?.refreshMinutes) || DEFAULT_REFRESH_MINUTES)));
    const filter = /^(?:all|medal|honor)$/.test(String(input?.filter || '')) ? String(input.filter) : 'all';
    const pinned = [...new Set((Array.isArray(input?.pinned) ? input.pinned : []).map(String)
      .filter(key => /^(?:medal|honor):\d+$/.test(key)))].slice(0, TRACK_LIMIT);
    return { refreshMinutes, filter, pinned };
  }

  function awardKey(kind, id) {
    return `${kind}:${Math.trunc(Number(id) || 0)}`;
  }

  function cleanText(value) {
    return String(value || '').replace(/<[^>]*>/g, ' ').replace(/&(?:nbsp|#160);/gi, ' ').replace(/\s+/g, ' ').trim();
  }

  function numericRequirementText(award) {
    const units = { zero:0, one:1, two:2, three:3, four:4, five:5, six:6, seven:7, eight:8, nine:9, ten:10, eleven:11, twelve:12, thirteen:13, fourteen:14, fifteen:15, sixteen:16, seventeen:17, eighteen:18, nineteen:19 };
    const tens = { twenty:20, thirty:30, forty:40, fifty:50, sixty:60, seventy:70, eighty:80, ninety:90 };
    const word = '(?:zero|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred)';
    return cleanText(award?.description || award?.name).replace(new RegExp(`\\b${word}(?:[ -]+${word})*\\b`, 'gi'), phrase => {
      let value = 0;
      for (const token of phrase.toLowerCase().split(/[ -]+/)) {
        if (Object.hasOwn(units, token)) value += units[token];
        else if (Object.hasOwn(tens, token)) value += tens[token];
        else if (token === 'hundred') value = Math.max(1, value) * 100;
      }
      return String(value);
    });
  }

  function normalizedRequirement(award) {
    return numericRequirementText(award).toLowerCase().replace(/\b(year|month|week|day|hour|minute|second)s?\b/g, '$1');
  }

  function requirementNumbers(award) {
    const matches = numericRequirementText(award).match(/\$?\s*\d[\d,]*(?:\.\d+)?(?:\s*(?:thousand|million|billion|trillion|mil|bn|[kmbt])\b|\s*(?:st|nd|rd|th)\b)?/gi) || [];
    const multipliers = { k:1e3, thousand:1e3, m:1e6, mil:1e6, million:1e6, b:1e9, bn:1e9, billion:1e9, t:1e12, trillion:1e12 };
    return matches.map(match => {
      const clean = match.toLowerCase().replace(/[$,\s]/g, '').replace(/(?:st|nd|rd|th)$/i, '');
      const unit = clean.match(/(thousand|million|billion|trillion|mil|bn|[kmbt])$/i)?.[1]?.toLowerCase() || '';
      return Number((unit ? clean.slice(0, -unit.length) : clean)) * (multipliers[unit] || 1);
    }).filter(Number.isFinite).map(value => Math.max(0, value));
  }

  function progressionFamily(award) {
    const text = normalizedRequirement(award);
    if (/\breach (?:the )?rank of\b/.test(text)) return `${award.kind}|${award?.type?.id ?? award?.type?.title ?? ''}|player-rank`;
    if (!requirementNumbers(award).length) return '';
    const requirement = normalizedRequirement(award)
      .replace(/\$?\s*\d[\d,]*(?:\.\d+)?(?:\s*(?:thousand|million|billion|trillion|mil|bn|[kmbt])\b|\s*(?:st|nd|rd|th)\b)?/gi, '#')
      .replace(/\s+/g, ' ').trim();
    return `${award.kind}|${award?.type?.id ?? award?.type?.title ?? ''}|${requirement}`;
  }

  function numericPersonalStats(body) {
    const result = {};
    const visited = new Set();
    const normalizePart = value => String(value || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
    function visit(value, path = [], depth = 0) {
      if (depth > 10 || value === null || value === undefined) return;
      if (Array.isArray(value)) {
        for (const row of value) {
          const name = normalizePart(row?.name ?? row?.key ?? row?.stat);
          if (name && Number.isFinite(Number(row?.value))) result[name] = Number(row.value);
          else visit(row, path, depth + 1);
        }
        return;
      }
      if (typeof value === 'object') {
        if (visited.has(value)) return;
        visited.add(value);
        for (const [key, child] of Object.entries(value)) visit(child, [...path, normalizePart(key)], depth + 1);
        return;
      }
      if (path.length && Number.isFinite(Number(value))) result[path.join('.')] = Number(value);
    }
    visit(body?.personalstats);
    return result;
  }

  function profileFromBody(body) {
    const profile = body?.profile && typeof body.profile === 'object' ? body.profile : {};
    const rankIndex = PLAYER_RANKS.findIndex(rank => rank.toLowerCase() === String(profile.rank || '').trim().toLowerCase()) + 1;
    return {
      id:Math.max(0, Math.trunc(Number(profile.id) || 0)),
      level:Math.max(0, Math.trunc(Number(profile.level) || 0)),
      age:Math.max(0, Math.trunc(Number(profile.age) || 0)),
      awards:Math.max(0, Math.trunc(Number(profile.awards) || 0)),
      forumPosts:Math.max(0, Math.trunc(Number(profile.forum_posts) || 0)),
      friends:Math.max(0, Math.trunc(Number(profile.friends) || 0)),
      enemies:Math.max(0, Math.trunc(Number(profile.enemies) || 0)),
      karma:Number.isFinite(Number(profile.karma)) ? Number(profile.karma) : 0,
      daysMarried:Math.max(0, Math.trunc(Number(profile.spouse?.days_married) || 0)),
      factionDays:Math.max(0, Math.trunc(Number(body?.faction?.days_in_faction ?? profile.faction?.days_in_faction ?? profile.faction?.days) || 0)),
      rank:String(profile.rank || ''),
      rankIndex:Math.max(0, rankIndex)
    };
  }

  function finishingHitsFromPersonalStats(body) {
    const direct = body?.personalstats?.finishing_hits;
    if (direct && typeof direct === 'object' && !Array.isArray(direct)) {
      const complete = Object.keys(FINISHER_LABELS).every(key => Object.hasOwn(direct, key) && Number.isFinite(Number(direct[key])));
      if (complete) return Object.fromEntries(Object.keys(FINISHER_LABELS).map(key => [key, Math.max(0, Math.trunc(Number(direct[key])))]));
    }
    const legacy = { heavy_artillery:'heavyhits', machine_guns:'machinehits', rifles:'riflehits', sub_machine_guns:'smghits', shotguns:'shotgunhits', pistols:'pistolhits', temporary:'temphits', piercing:'piercinghits', slashing:'slashinghits', clubbing:'clubbinghits', mechanical:'mechanicalhits', hand_to_hand:'h2hhits' };
    const stats = numericPersonalStats(body);
    const complete = Object.entries(legacy).every(([key, old]) => Number.isFinite(Number(stats[`finishing_hits.${key}`] ?? stats[old])));
    return complete ? Object.fromEntries(Object.entries(legacy).map(([key, old]) => [key, Math.max(0, Math.trunc(Number(stats[`finishing_hits.${key}`] ?? stats[old])))])) : null;
  }

  function categoryTitle(award) {
    return String(award?.type?.title || '').trim().toLowerCase();
  }

  function catalogRows(snapshot = {}) {
    const completedMedals = new Set((snapshot.medals || []).map(row => Math.trunc(Number(row?.id ?? row))));
    const completedHonors = new Set((snapshot.honors || []).map(row => Math.trunc(Number(row?.id ?? row))));
    return [
      ...(snapshot.catalogMedals || []).map(award => ({ ...award, kind:'medal', completed:completedMedals.has(Math.trunc(Number(award?.id))) })),
      ...(snapshot.catalogHonors || []).map(award => ({ ...award, kind:'honor', completed:completedHonors.has(Math.trunc(Number(award?.id))) }))
    ].filter(award => Number(award?.id) > 0 && award?.name)
      .filter(award => !(award.kind === 'honor' && (categoryTitle(award) === 'default' || Number(award?.type?.id) === 1)))
      .filter(award => !/\b(?:auto thefts?|grand theft auto)\b/i.test(`${categoryTitle(award)} ${cleanText(award.description)}`));
  }

  function statValue(snapshot, ...paths) {
    for (const path of paths.flat()) {
      const value = snapshot?.personalStats?.[path];
      if (Number.isFinite(Number(value))) return Number(value);
    }
    return null;
  }

  function objectiveProgress(award, snapshot = {}) {
    const text = normalizedRequirement(award);
    const numbers = requirementNumbers(award);
    const target = numbers[0];
    const result = (current, label, customTarget = target) => Number.isFinite(Number(current)) && Number(customTarget) > 0
      ? { rows:[{ current:Math.max(0, Number(current)), target:Number(customTarget), label }] }
      : null;
    const stat = (paths, label, customTarget = target, transform = value => value) => {
      const current = statValue(snapshot, paths);
      return current === null ? null : result(transform(current), label, customTarget);
    };
    const profile = snapshot.profile || {};

    if (/\b(?:live|living|citizen|been)\b.*\btorn\b.*\b(?:year|day)/i.test(text)) return result(profile.age, 'days in Torn', /\byear\b/.test(text) ? target * 365 : target);
    if (/\bmarriage\b|\bmarried\b.*\b(?:day|year|commitment)\b|\b(?:day|year)\b.*\bmarried\b/i.test(text)) return result(profile.daysMarried, 'days married', /\byear\b/.test(text) ? target * 365 : target);
    if (/\bfaction\b.*\b(?:commitment|days?|years?)\b|\b(?:days?|years?)\b.*\b(?:same )?faction\b/i.test(text)) return result(profile.factionDays, 'days in faction', /\byear\b/.test(text) ? target * 365 : target);
    if (/\bdonator\b.*\b(?:days?|years?|commitment)\b/i.test(text)) return stat('other.donator_days', 'donator days', /\byear\b/.test(text) ? target * 365 : target);
    if (/\breach\s+(?:level\s+)?\d|\battain\s+level\b/i.test(text) && /\blevel\b/i.test(text)) return result(profile.level, 'level');
    if (/\breach (?:the )?rank of\b/i.test(text)) {
      const targetRank = PLAYER_RANKS.findIndex(rank => text.includes(rank.toLowerCase())) + 1;
      return result(profile.rankIndex, 'rank', targetRank);
    }
    if (/\bforum posts?\b/i.test(text)) return result(profile.forumPosts, 'forum posts');
    if (/\bkarma\b/i.test(text)) return result(profile.karma, 'karma');

    const finisher = Object.entries({ heavy_artillery:/heavy artillery/, machine_guns:/machine guns?/, rifles:/rifles?/, sub_machine_guns:/(?:sub[ -]?machine guns?|smgs?)/, shotguns:/shotguns?/, pistols:/pistols?/, temporary:/temporary (?:items?|weapons?)/, piercing:/piercing weapons?/, slashing:/slashing weapons?/, clubbing:/clubbing weapons?/, mechanical:/mechanical weapons?/, hand_to_hand:/(?:hand[ -]to[ -]hand|unarmed|fists?)/ }).find(([, pattern]) => pattern.test(text));
    if (/finishing hits?/i.test(text) && finisher) return result(snapshot.finishingHits?.[finisher[0]], `${FINISHER_LABELS[finisher[0]]} finishing hits`);
    if (/\bwin\b.*\battacks?\b.*\band\b.*\bdefends?\b/i.test(text) && numbers.length >= 2) {
      const attacks = statValue(snapshot, 'attacking.attacks.won');
      const defends = statValue(snapshot, 'attacking.defends.won');
      return attacks === null || defends === null ? null : { rows:[{ current:attacks, target:numbers[0], label:'attacks won' }, { current:defends, target:numbers[1], label:'defends won' }] };
    }
    if (/\bwin\b.*\bstealth(?:ed)? attacks?\b/i.test(text)) return stat('attacking.attacks.stealth', 'stealthed attacks won');
    if (/\bwin\b.*\battacks?\b/i.test(text)) return stat('attacking.attacks.won', 'attacks won');
    if (/\b(?:lose|lost)\b.*\battacks?\b/i.test(text)) return stat('attacking.attacks.lost', 'attacks lost');
    if (/\bassist(?:ed)?\b.*\battacks?\b/i.test(text)) return stat('attacking.attacks.assist', 'attack assists');
    if (/\bstalemates?\b/i.test(text)) return stat('attacking.attacks.stalemate', 'attack stalemates');
    if (/\bwin\b.*\bdefends?\b|\bsuccessfully defend(?:ed)?\b/i.test(text)) return stat('attacking.defends.won', 'defends won');
    if (/\b(?:lose|lost)\b.*\bdefends?\b/i.test(text)) return stat('attacking.defends.lost', 'defends lost');
    if (/\benemies? escape\b|\bfoes? escape\b/i.test(text)) return stat('attacking.escapes.foes', 'enemies escaped');
    if (/\b(?:escape|run away)\b.*\b(?:foes?|opponents?|attacks?)\b/i.test(text)) return stat('attacking.escapes.player', 'successful escapes');
    if (/\bkill streak\b/i.test(text)) return stat('attacking.killstreak.best', 'best kill streak');
    if (/\bcritical hits?\b/i.test(text)) return stat('attacking.hits.critical', 'critical hits');
    if (/\bone[ -]hit kills?\b/i.test(text)) return stat('attacking.hits.one_hit_kills', 'one-hit kills');
    if (/\bretaliation hits?\b|\bperform\b.*\bretaliations?\b/i.test(text)) return stat('attacking.faction.retaliations', 'retaliation hits');
    if (/\branked war hits?\b/i.test(text)) return stat('attacking.faction.ranked_war_hits', 'ranked war hits');
    if (/\braid hits?\b/i.test(text)) return stat('attacking.faction.raid_hits', 'raid hits');
    if (/\b(?:earn|gain)\b.*\bfaction respect\b|\brespect\b.*\bfor (?:your )?faction\b/i.test(text)) return stat('attacking.faction.respect', 'faction respect earned');
    if (/\bcollect\b.*\bbounties?\b/i.test(text)) return stat('bounties.collected.amount', 'bounties collected');
    if (/\bbust\b.*\bpeople|\bpeople busted\b/i.test(text)) return stat('jail.busts.success', 'successful busts');
    if (/\bmedical items?\b/i.test(text)) return stat('hospital.medical_items_used', 'medical items used');
    if (/\bwithdraw\b.*\bblood\b/i.test(text)) return stat('hospital.blood_withdrawn', 'blood bags withdrawn');
    if (/\brevive\b.*\b(?:people|players?|times?)\b|\bperform\b.*\brevives?\b/i.test(text)) return stat('hospital.reviving.revives', 'revives performed');
    if (/\borganized crimes?\b/i.test(text)) return stat(['crimes.offenses.organized_crimes','crimes.organized_crimes'], 'organized crimes');
    if (/\btotal crimes?\b|\bcriminal offenses?\b/i.test(text)) return stat(['crimes.offenses.total','crimes.total'], 'criminal offenses');
    const crimeType = Object.entries({
      vandalism:/vandalism/, fraud:/fraud/, theft:/\bthefts?\b/, counterfeiting:/counterfeit/,
      illicit_services:/illicit services?/, cybercrime:/cybercrime/, extortion:/extortion/,
      illegal_production:/illegal production/
    }).find(([, pattern]) => pattern.test(text));
    if (/\b(?:crimes?|offenses?)\b/i.test(text) && crimeType) return stat([`crimes.offenses.${crimeType[0]}`, `crimes.${crimeType[0]}`], `${crimeType[0].replace(/_/g, ' ')} offenses`);
    if (/\bfind\b.*\bitems?\b.*\bcity\b/i.test(text)) return stat('items.found.city', 'items found in the city');
    if (/\bfind\b.*\bitems?\b.*\bdump\b/i.test(text)) return stat('items.found.dump', 'items found in the dump');
    if (/\b(?:use|used)\b.*\bboosters?\b/i.test(text)) return stat('items.used.boosters', 'boosters used');
    if (/\b(?:drink|use|used)\b.*\benergy drinks?\b/i.test(text)) return stat('items.used.energy_drinks', 'energy drinks used');
    if (/\b(?:use|used|take|taken)\b.*\bdrugs?\b/i.test(text)) return stat('drugs.total', 'drugs used');
    if (/\boverdoses?\b/i.test(text)) return stat('drugs.overdoses', 'overdoses');
    if (/\bmission contracts?\b/i.test(text)) return stat('missions.contracts.total', 'mission contracts');
    if (/\bmission credits?\b/i.test(text)) return stat('missions.credits', 'mission credits');
    if (/\bcomplete\b.*\bmissions?\b/i.test(text)) return stat('missions.missions', 'missions completed');
    if (/\bwin\b.*\braces?\b/i.test(text)) return stat('racing.races.won', 'races won');
    if (/\benter\b.*\braces?\b/i.test(text)) return stat('racing.races.entered', 'races entered');
    if (/\btravel\b.*\btimes?\b/i.test(text)) return stat('travel.total', 'trips completed');
    if (/\benergy refills?\b/i.test(text)) return stat('other.refills.energy', 'energy refills used');
    if (/\bnerve refills?\b/i.test(text)) return stat('other.refills.nerve', 'nerve refills used');
    if (/\branked war wins?\b/i.test(text)) return stat('other.ranked_war_wins', 'ranked war wins');
    if (/\bnet\s*worth\b/i.test(text)) return stat('networth.total', 'networth');
    return null;
  }

  function isWarMachine(award) {
    return /\bwar\s+machine\b/i.test(String(award?.name || '')) || (/\b1,?000\b/i.test(cleanText(award?.description)) && /finishing hits?/i.test(cleanText(award?.description)) && /\b(?:every|all) categor(?:y|ies)\b/i.test(cleanText(award?.description)));
  }

  function warMachineProgress(snapshot = {}) {
    if (!snapshot.finishingHits) return null;
    const rows = Object.entries(FINISHER_LABELS).map(([key, label]) => ({ current:Math.max(0, Math.trunc(Number(snapshot.finishingHits[key]) || 0)), target:FINISHER_TARGET, label }));
    return { rows };
  }

  function withProgress(award, snapshot) {
    const progress = isWarMachine(award) ? warMachineProgress(snapshot) : objectiveProgress(award, snapshot);
    const percent = progress?.rows?.length ? Math.min(100, ...progress.rows.map(row => Math.floor(row.current / row.target * 100))) : null;
    return { ...award, key:awardKey(award.kind, award.id), progress, percent };
  }

  function buildView(snapshot = {}, inputSettings = {}) {
    const settings = normalizeSettings(inputSettings);
    const all = catalogRows(snapshot);
    const byKey = new Map(all.map(award => [awardKey(award.kind, award.id), award]));
    const incomplete = all.filter(award => !award.completed && (settings.filter === 'all' || award.kind === settings.filter));
    const activePinned = settings.pinned.filter(key => byKey.has(key) && !byKey.get(key).completed);
    const families = new Map();
    for (const award of incomplete) {
      const family = progressionFamily(award) || `unique:${awardKey(award.kind, award.id)}`;
      if (!families.has(family)) families.set(family, []);
      families.get(family).push(award);
    }
    const goals = [];
    for (const family of families.values()) {
      family.sort((a, b) => {
        const left = requirementNumbers(a), right = requirementNumbers(b);
        for (let index = 0; index < Math.max(left.length, right.length); index += 1) {
          if ((left[index] || 0) !== (right[index] || 0)) return (left[index] || 0) - (right[index] || 0);
        }
        return Number(a.id) - Number(b.id);
      });
      const current = withProgress(family[0], snapshot);
      current.laterMilestones = family.slice(1).map(award => ({ key:awardKey(award.kind, award.id), name:String(award.name), targets:requirementNumbers(award) }));
      goals.push(current);
    }
    goals.sort((a, b) => Number(activePinned.includes(b.key)) - Number(activePinned.includes(a.key)) || categoryTitle(a).localeCompare(categoryTitle(b)) || String(a.name).localeCompare(String(b.name)));
    const pinned = activePinned.map(key => byKey.get(key)).map(award => withProgress(award, snapshot));
    return {
      goals,
      pinned,
      completedCount:all.filter(award => award.completed).length,
      totalCount:all.length,
      availableMerits:Number(snapshot?.merits?.available ?? snapshot?.merits?.points ?? 0) || 0,
      settings:{ ...settings, pinned:activePinned }
    };
  }

  SLINK.define('core', 'merits', Object.freeze({
    CATALOG_MAX_AGE_MS,
    DEFAULT_REFRESH_MINUTES,
    REQUIRED_SCOPE,
    TRACK_LIMIT,
    awardKey,
    buildView,
    catalogRows,
    defaultSettings,
    finishingHitsFromPersonalStats,
    normalizeSettings,
    numericPersonalStats,
    objectiveProgress,
    profileFromBody,
    requirementNumbers
  }));
})(globalThis);
