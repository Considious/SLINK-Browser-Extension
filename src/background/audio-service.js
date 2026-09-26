(function installAudioService(global) {
  'use strict';

  const SLINK = global.SLINK_EXTENSION;
  if (!SLINK) throw new Error('SLINK runtime must load before background audio.');

  const OFFSCREEN_DOCUMENT_PATH = 'src/offscreen/audio.html';
  let creatingDocument = null;
  let flushing = null;

  async function offscreenDocumentExists() {
    const documentUrl = chrome.runtime.getURL(OFFSCREEN_DOCUMENT_PATH);
    if (typeof chrome.runtime.getContexts === 'function') {
      const contexts = await chrome.runtime.getContexts({
        contextTypes:['OFFSCREEN_DOCUMENT'],
        documentUrls:[documentUrl]
      });
      return contexts.length > 0;
    }
    if (typeof global.clients?.matchAll === 'function') {
      const clients = await global.clients.matchAll();
      return clients.some(client => client.url === documentUrl);
    }
    return false;
  }

  async function ensureOffscreenDocument() {
    if (await offscreenDocumentExists()) return;
    if (!creatingDocument) {
      creatingDocument = chrome.offscreen.createDocument({
        url:OFFSCREEN_DOCUMENT_PATH,
        reasons:['AUDIO_PLAYBACK'],
        justification:'Play user-enabled SLINK alert sounds while Torn or the extension dashboard is not focused.'
      }).finally(() => { creatingDocument = null; });
    }
    await creatingDocument;
  }

  async function play(sound = {}) {
    await ensureOffscreenDocument();
    const message = {
      target:'slink-offscreen-audio', type:'play',
      sound:{ soundChoice:String(sound.soundChoice || 'chime'), customSoundDataUrl:String(sound.customSoundDataUrl || '') }
    };
    let response;
    try { response = await chrome.runtime.sendMessage(message); }
    catch (error) {
      if (!/receiving end does not exist/i.test(String(error?.message || error))) throw error;
      await new Promise(resolve => setTimeout(resolve, 100));
      response = await chrome.runtime.sendMessage(message);
    }
    if (!response?.ok) throw new Error(response?.error || 'The SLINK background audio document could not play the alert.');
    return { played:true };
  }

  async function flush() {
    if (flushing) return flushing;
    flushing = (async () => {
      const claims = await Promise.all([
        SLINK.services.adhd.routes['adhd.sound.claim'](),
        SLINK.services.market.routes['market.sound.claim']()
      ]);
      const results = [];
      for (const claim of claims) {
        if (!claim?.play) continue;
        await play(claim);
        if (Array.isArray(claim.alertIds)) await SLINK.services.adhd.routes['adhd.sound.ack']({ alertIds:claim.alertIds });
        if (Array.isArray(claim.dealKeys)) await SLINK.services.market.routes['market.sound.ack']({ dealKeys:claim.dealKeys });
        results.push({ alertIds:claim.alertIds || [], dealKeys:claim.dealKeys || [] });
      }
      return { played:results.length, results };
    })();
    try { return await flushing; } finally { flushing = null; }
  }

  const routes = Object.freeze({
    'audio.play':payload => play(payload),
    'audio.flush':flush
  });

  SLINK.define('services', 'audio', Object.freeze({ flush, play, routes }));
})(globalThis);
