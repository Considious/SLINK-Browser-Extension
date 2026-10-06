(function installPlayerIntelligenceDom(global) {
  'use strict';

  const SLINK = global.SLINK_EXTENSION;
  if (!SLINK) throw new Error('SLINK runtime must load before DOM player intelligence.');

  const INTENT_KEY = 'slink-extension:player-profile-intent:v1';
  const INTENT_MS = 5 * 60_000;
  const OBSERVE_DEBOUNCE_MS = 250;
  const STATUS_SELECTORS = Object.freeze([
    '[class*="profile"] [class*="status"]',
    '[class*="basic-information"]',
    '[data-testid*="status"]',
    '[class*="status"]'
  ]);
  let observer = null;
  let timer = null;
  let busy = false;
  let lastSignature = '';

  function parseRemainingMs(value) {
    const text = String(value || '').toLowerCase();
    let total = 0;
    for (const [pattern, unit] of [
      [/([0-9]+)\s*d(?:ay)?s?/, 86_400_000],
      [/([0-9]+)\s*h(?:our)?s?/, 3_600_000],
      [/([0-9]+)\s*m(?:in(?:ute)?)?s?/, 60_000],
      [/([0-9]+)\s*s(?:ec(?:ond)?)?s?/, 1_000]
    ]) {
      const match = text.match(pattern);
      if (match) total += Number(match[1]) * unit;
    }
    if (total) return total;
    const clock = text.match(/(?:(\d+)\s*d(?:ays?)?\s*)?(\d{1,2}):(\d{2}):(\d{2})/);
    if (!clock) return 0;
    return ((Number(clock[1]) || 0) * 86400 + Number(clock[2]) * 3600 +
      Number(clock[3]) * 60 + Number(clock[4])) * 1000;
  }

  function detectState(value) {
    const lower = String(value || '').toLowerCase();
    if (lower.includes('federal jail')) return 'Federal';
    if (lower.includes('hiding out')) return 'Hiding Out';
    if (lower.includes('hospitalized') || lower.includes('in hospital') || lower.includes('hospital')) return 'Hospital';
    if (lower.includes('in jail') || /\bjailed\b/.test(lower)) return 'Jail';
    if (lower.includes('traveling') || lower.includes('travelling') || lower.includes('flying') || lower.includes('returning to torn')) return 'Traveling';
    if (lower.includes('abroad')) return 'Abroad';
    if (/\bokay\b/.test(lower)) return 'Okay';
    return '';
  }

  function epochSeconds(value) {
    if (value == null || value === '') return 0;
    const numeric = Number(value);
    if (Number.isFinite(numeric) && numeric > 0) {
      const seconds = numeric > 10_000_000_000 ? numeric / 1000 : numeric;
      if (seconds > Date.now() / 1000 - 86_400) return Math.trunc(seconds);
    }
    const parsed = Date.parse(String(value));
    return Number.isFinite(parsed) && parsed > Date.now() - 86_400_000
      ? Math.trunc(parsed / 1000)
      : 0;
  }

  function untilFromNode(node, text) {
    const candidates = [node, ...node.querySelectorAll?.('[data-until],[data-timestamp],[data-time],time[datetime]') || []];
    for (const item of candidates) {
      for (const name of ['data-until', 'data-timestamp', 'data-time', 'datetime']) {
        const until = epochSeconds(item.getAttribute?.(name));
        if (until) return until;
      }
    }
    const remaining = parseRemainingMs(text);
    return remaining > 0 ? Math.floor((Date.now() + remaining) / 1000) : 0;
  }

  function activeProfile(expectedPlayerId = 0) {
    if (!global.document || global.document.visibilityState !== 'visible' || !global.document.hasFocus?.()) {
      return { active:false, reason:'inactive-page' };
    }
    let url;
    try { url = new URL(global.location.href); } catch { return { active:false, reason:'invalid-url' }; }
    if (!url.pathname.toLowerCase().includes('profiles.php')) return { active:false, reason:'not-profile' };
    const playerId = SLINK.core.playerIntelligence.validPlayerId(url.searchParams.get('XID'));
    if (!playerId) return { active:false, reason:'missing-player' };
    if (expectedPlayerId && Number(expectedPlayerId) !== playerId) return { active:false, reason:'different-player' };
    return { active:true, playerId, url };
  }

  function rememberIntent(playerId, source = 'profile') {
    const id = SLINK.core.playerIntelligence.validPlayerId(playerId);
    if (!id) return false;
    try {
      global.sessionStorage.setItem(INTENT_KEY, JSON.stringify({
        playerId:id,
        source:String(source || 'profile').slice(0, 80),
        expiresAt:Date.now() + INTENT_MS
      }));
      schedule();
      return true;
    } catch {
      return false;
    }
  }

  function readIntent() {
    try {
      const value = JSON.parse(global.sessionStorage.getItem(INTENT_KEY) || 'null');
      const playerId = SLINK.core.playerIntelligence.validPlayerId(value?.playerId);
      if (!playerId || Number(value?.expiresAt) <= Date.now()) {
        global.sessionStorage.removeItem(INTENT_KEY);
        return null;
      }
      return { playerId, source:String(value.source || 'profile'), expiresAt:Number(value.expiresAt) };
    } catch {
      try { global.sessionStorage.removeItem(INTENT_KEY); } catch {}
      return null;
    }
  }

  function clearIntent() {
    try { global.sessionStorage.removeItem(INTENT_KEY); } catch {}
  }

  function playerName(playerId) {
    for (const selector of [
      'h1 [class*="name"]',
      '[class*="profile"] h1',
      '[class*="user-information"] [class*="name"]',
      'h1'
    ]) {
      const text = String(global.document.querySelector(selector)?.textContent || '').trim();
      if (!text) continue;
      const cleaned = text.replace(new RegExp('\\s*\\[' + playerId + '\\].*$'), '').trim();
      if (cleaned && cleaned.length <= 80) return cleaned;
    }
    return '';
  }

  function bountyObservation() {
    const nodes = [...global.document.querySelectorAll('[class*="bount"],[data-testid*="bount"]')];
    const text = nodes.map(node => String(node.innerText || node.textContent || '')).join(' ');
    if (!text) return {};
    const rewards = [...text.matchAll(/\$\s*([0-9][0-9,]*)/g)]
      .map(match => Number(match[1].replaceAll(',', '')))
      .filter(Number.isFinite);
    if (!rewards.length) return {};
    return {
      bountyCount:rewards.length,
      bountyTotal:rewards.reduce((sum, reward) => sum + reward, 0)
    };
  }

  function currentObservation(playerId, source) {
    const candidates = [];
    const seen = new Set();
    for (const selector of STATUS_SELECTORS) {
      for (const node of global.document.querySelectorAll(selector)) {
        if (seen.has(node)) continue;
        seen.add(node);
        const text = String(node.innerText || node.textContent || '').replace(/\s+/g, ' ').trim();
        if (!text || text.length > 1_000) continue;
        const state = detectState(text);
        if (!state) continue;
        candidates.push({ node, text, state });
      }
    }
    candidates.sort((left, right) => left.text.length - right.text.length);
    const match = candidates[0];
    if (!match) return null;
    const now = Date.now();
    return {
      playerId,
      name:playerName(playerId),
      state:match.state,
      until:untilFromNode(match.node, match.text),
      description:match.text.slice(0, 500),
      ...bountyObservation(),
      source:`dom:${String(source || 'profile').replace(/^dom:/, '').slice(0, 70)}`,
      observationKind:'dom',
      lastDomObservedAt:now,
      observedAt:now,
      checkedAt:now
    };
  }

  async function observeCurrentPage({ playerId = 0, source = 'profile', requireIntent = true } = {}) {
    if (busy) return { observed:false, reason:'busy' };
    const profile = activeProfile(playerId);
    if (!profile.active) return { observed:false, reason:profile.reason };
    const intent = readIntent();
    if (requireIntent && (!intent || intent.playerId !== profile.playerId)) {
      return { observed:false, reason:'no-matching-intent' };
    }
    const observation = currentObservation(profile.playerId, intent?.source || source);
    if (!observation) return { observed:false, reason:'status-not-found' };
    const signature = `${observation.playerId}:${observation.state}:${observation.until}:${observation.description}`;
    if (signature === lastSignature) {
      if (requireIntent) clearIntent();
      return { observed:false, reason:'unchanged' };
    }
    busy = true;
    try {
      const record = await SLINK.core.messaging.send('playerIntelligence.observe', observation);
      lastSignature = signature;
      if (requireIntent) clearIntent();
      return { observed:true, reason:'dom', record, observation };
    } finally {
      busy = false;
    }
  }

  function schedule() {
    clearTimeout(timer);
    timer = setTimeout(() => void observeCurrentPage(), OBSERVE_DEBOUNCE_MS);
  }

  function start() {
    if (!global.document?.documentElement || observer) return;
    observer = new MutationObserver(schedule);
    observer.observe(global.document.documentElement, { childList:true, subtree:true });
    global.document.addEventListener('visibilitychange', schedule);
    global.addEventListener('focus', schedule);
    global.addEventListener('hashchange', schedule);
    global.addEventListener('popstate', schedule);
    schedule();
  }

  function stop() {
    clearTimeout(timer);
    observer?.disconnect();
    observer = null;
  }

  SLINK.define('core', 'playerIntelligenceDom', Object.freeze({
    INTENT_KEY,
    activeProfile,
    clearIntent,
    currentObservation,
    detectState,
    observeCurrentPage,
    parseRemainingMs,
    readIntent,
    rememberIntent,
    start,
    stop
  }));

  if (global.document) start();
})(globalThis);
