(function installOffscreenAudio(global) {
  'use strict';

  const SLINK = global.SLINK_EXTENSION;
  if (!SLINK?.core?.adhd) throw new Error('SLINK audio dependencies did not load.');

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message?.target !== 'slink-offscreen-audio' || message?.type !== 'play') return false;
    Promise.resolve()
      .then(() => SLINK.core.adhd.playNotificationSound(message.sound || {}))
      .then(() => sendResponse({ ok:true }))
      .catch(error => sendResponse({ ok:false, error:String(error?.message || error || 'Audio playback failed.') }));
    return true;
  });
})(globalThis);
