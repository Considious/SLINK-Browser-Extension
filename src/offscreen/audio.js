(function installOffscreenAudio(global) {
  'use strict';

  const activeAudio = new Set();

  function writeText(view, offset, value) {
    for (let index = 0; index < value.length; index += 1) view.setUint8(offset + index, value.charCodeAt(index));
  }

  function notificationWav(choice = 'chime') {
    const patterns = {
      chime:[[0, 660, 0.16], [0.13, 880, 0.24]],
      bell:[[0, 880, 0.15], [0.18, 660, 0.18], [0.38, 880, 0.25]],
      urgent:[[0, 440, 0.17], [0.21, 440, 0.17], [0.42, 660, 0.28]]
    };
    const notes = patterns[choice] || patterns.chime;
    const sampleRate = 44_100;
    const duration = Math.max(...notes.map(([offset, , length]) => offset + length)) + 0.08;
    const sampleCount = Math.ceil(duration * sampleRate);
    const samples = new Float32Array(sampleCount);
    for (const [offset, frequency, length] of notes) {
      const first = Math.floor(offset * sampleRate);
      const count = Math.floor(length * sampleRate);
      for (let index = 0; index < count && first + index < samples.length; index += 1) {
        const elapsed = index / sampleRate;
        const attack = Math.min(1, elapsed / 0.012);
        const release = Math.min(1, Math.max(0, (length - elapsed) / 0.055));
        const wave = choice === 'urgent'
          ? Math.sign(Math.sin(2 * Math.PI * frequency * elapsed))
          : Math.sin(2 * Math.PI * frequency * elapsed);
        samples[first + index] += wave * attack * release * (choice === 'urgent' ? 0.38 : 0.52);
      }
    }
    const buffer = new ArrayBuffer(44 + sampleCount * 2);
    const view = new DataView(buffer);
    writeText(view, 0, 'RIFF'); view.setUint32(4, 36 + sampleCount * 2, true); writeText(view, 8, 'WAVE');
    writeText(view, 12, 'fmt '); view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true);
    view.setUint32(24, sampleRate, true); view.setUint32(28, sampleRate * 2, true); view.setUint16(32, 2, true); view.setUint16(34, 16, true);
    writeText(view, 36, 'data'); view.setUint32(40, sampleCount * 2, true);
    for (let index = 0; index < sampleCount; index += 1) {
      const sample = Math.max(-1, Math.min(1, samples[index]));
      view.setInt16(44 + index * 2, Math.round(sample * 0x7fff), true);
    }
    return new Blob([buffer], { type:'audio/wav' });
  }

  async function playAudioSource(source, revoke = false) {
    const audio = new Audio();
    audio.preload = 'auto';
    audio.autoplay = false;
    audio.muted = false;
    audio.volume = 1;
    audio.src = source;
    activeAudio.add(audio);
    const cleanup = () => {
      activeAudio.delete(audio);
      if (revoke) URL.revokeObjectURL(source);
    };
    audio.addEventListener('ended', cleanup, { once:true });
    audio.addEventListener('error', cleanup, { once:true });
    try {
      await audio.play();
      return true;
    } catch (error) {
      cleanup();
      throw error;
    }
  }

  async function playNotificationSound(input = {}) {
    const choice = String(input.soundChoice || 'chime');
    const custom = String(input.customSoundDataUrl || '');
    if (choice === 'custom') {
      if (!/^data:audio\//i.test(custom)) throw new Error('Upload a custom audio file before selecting Custom.');
      return playAudioSource(custom, false);
    }
    const source = URL.createObjectURL(notificationWav(choice));
    return playAudioSource(source, true);
  }

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message?.target !== 'slink-offscreen-audio' || message?.type !== 'play') return false;
    Promise.resolve()
      .then(() => playNotificationSound(message.sound || {}))
      .then(() => sendResponse({ ok:true }))
      .catch(error => sendResponse({ ok:false, error:String(error?.message || error || 'Audio playback failed.') }));
    return true;
  });
})(globalThis);
