(function installPageActivity(global) {
  'use strict';
  // The worker owns the grant; local lifecycle signals may revoke it immediately.
  let granted = false;
  let present = true;
  let generation = 0;
  const subscribers = new Set();
  function eligible() {
    return granted && present && global.document?.visibilityState === 'visible'
      && global.document.hasFocus?.() === true;
  }
  function changed() {
    generation += 1;
    for (const subscriber of subscribers) subscriber(eligible());
  }
  function setGranted(value) {
    if (granted === Boolean(value)) return;
    granted = Boolean(value);
    changed();
  }
  function subscribe(callback) { subscribers.add(callback); return () => subscribers.delete(callback); }
  function token() { return generation; }
  function current(value) { return value === generation && eligible(); }
  global.document?.addEventListener('visibilitychange', changed);
  global.addEventListener?.('blur', () => { granted = false; changed(); });
  global.addEventListener?.('pagehide', () => { present = false; granted = false; changed(); });
  global.addEventListener?.('pageshow', () => { present = true; changed(); });
  global.SLINK_EXTENSION.define('core', 'pageActivity', Object.freeze({ eligible, setGranted, subscribe, token, current }));
})(globalThis);
