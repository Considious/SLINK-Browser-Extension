(function installSlinkXanaxSafety(global) {
  'use strict';

  if (global.__SLINK_XANAX_SAFETY_INSTALLED__) return;
  Object.defineProperty(global, '__SLINK_XANAX_SAFETY_INSTALLED__', { value:true });

  const XANAX_ITEM_ID = '206';
  const XANAX_GAIN = 250;
  const SAFE_ENERGY_LIMIT = 750;
  const ENERGY_OVERFLOW_CAP = 1000;
  const WARNING_ATTRIBUTE = 'data-slink-xanax-warning';
  const ACTION_SELECTOR = [
    'button.option-use[aria-label="Take Xanax"]',
    'button[aria-label="Take Xanax"]',
    'a.use[data-role="use"][aria-label^="Xanax"]',
    'a[data-role="use"][aria-label^="Xanax"]',
    `[data-id="${XANAX_ITEM_ID}"][title="Xanax"]`
  ].join(',');

  function integer(value) {
    const parsed = Number(String(value ?? '').replace(/,/g, ''));
    return Number.isFinite(parsed) && parsed >= 0 ? Math.floor(parsed) : null;
  }

  function energyPair(value) {
    const match = String(value || '').replace(/\u00a0/g, ' ').match(/(\d[\d,]*)\s*\/\s*(\d[\d,]*)/);
    if (!match) return null;
    const current = integer(match[1]);
    const maximum = integer(match[2]);
    return current === null || maximum === null || maximum <= 0 ? null : { current, maximum };
  }

  function energyFrom(node) {
    if (!node) return null;
    for (const value of [node.getAttribute?.('aria-label'), node.getAttribute?.('title'), node.textContent]) {
      const pair = energyPair(value);
      if (pair) return pair;
    }
    return null;
  }

  function currentEnergy() {
    const candidates = new Set();
    const selectors = [
      '#barEnergy',
      '[id^="barEnergy"]',
      '[id*="barEnergy"]',
      '[data-stat="energy"]',
      '[data-testid*="energy" i]',
      '[aria-label*="energy" i]',
      '[class*="barEnergy"]',
      'a[href*="gym.php"]'
    ];
    for (const selector of selectors) {
      for (const node of document.querySelectorAll(selector)) {
        candidates.add(node);
        const container = node.closest?.('li,[class*="bar" i],[class*="stat" i]');
        if (container) candidates.add(container);
      }
    }
    for (const node of candidates) {
      const pair = energyFrom(node);
      if (pair) return pair.current;
    }
    return null;
  }

  function xanaxAction(target) {
    const node = target?.nodeType === 1 ? target : target?.parentElement;
    if (!node?.closest || node.closest('.tt-close-icon')) return null;
    const action = node.closest(ACTION_SELECTOR);
    if (!action) return null;
    if (action.matches(`[data-id="${XANAX_ITEM_ID}"]`) && node.closest('.tt-close-icon')) return null;
    return action;
  }

  function warningMessage(current) {
    const wasted = Math.max(0, current + XANAX_GAIN - ENERGY_OVERFLOW_CAP);
    return `You currently have ${current.toLocaleString()} energy.\n\nBy using this Xanax you will waste ${wasted.toLocaleString()} energy.\n\nAre you sure you want to use it?`;
  }

  function handleXanaxUse(event) {
    if (!global.SLINK_EXTENSION.core.pageActivity.eligible()) return;
    const action = xanaxAction(event.target);
    if (!action) return;
    const energy = currentEnergy();
    if (energy === null || energy <= SAFE_ENERGY_LIMIT) return;
    if (global.confirm(warningMessage(energy))) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
  }

  let decorateScheduled = false;
  function decorateXanaxActions() {
    decorateScheduled = false;
    if (!global.SLINK_EXTENSION.core.pageActivity.eligible()) return;
    const energy = currentEnergy();
    const guarded = energy !== null && energy > SAFE_ENERGY_LIMIT;
    for (const action of document.querySelectorAll(ACTION_SELECTOR)) {
      action.toggleAttribute(WARNING_ATTRIBUTE, guarded);
      if (guarded) action.setAttribute('aria-description', `SLINK safety confirmation required. Current energy: ${energy}.`);
      else action.removeAttribute('aria-description');
    }
  }

  function scheduleDecoration() {
    if (decorateScheduled || !global.SLINK_EXTENSION.core.pageActivity.eligible()) return;
    decorateScheduled = true;
    global.requestAnimationFrame(decorateXanaxActions);
  }

  const style = document.createElement('style');
  style.id = 'slink-xanax-safety-style';
  style.textContent = `[${WARNING_ATTRIBUTE}="true"]{outline:2px solid #f59e0b!important;outline-offset:2px!important}`;
  (document.head || document.documentElement).appendChild(style);

  document.addEventListener('click', handleXanaxUse, true);
  const observer = new MutationObserver(scheduleDecoration);
  global.SLINK_EXTENSION.core.pageActivity.subscribe(active => {
    observer.disconnect();
    if (!active) return;
    observer.observe(document.documentElement, { childList:true, subtree:true, characterData:true });
    scheduleDecoration();
  });

  // Keep the guarded click handler for a BFCache pageshow; the activity adapter
  // disconnects observation during pagehide and reconnects after a fresh grant.
})(globalThis);
