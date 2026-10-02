(function installFactionChat(global) {
  'use strict';

  const SLINK = global.SLINK_EXTENSION;
  if (!SLINK) throw new Error('SLINK runtime must load before Faction Chat helpers.');

  const SEND_ICON_PATH_PREFIX = 'M18,0l-4.5,16.5-6.1-5.43';
  const FACTION_COMPOSER_SELECTOR = 'textarea[placeholder="Type your message here..."],textarea[class*="_resizable-chat_"],textarea[class*="textarea___"]';
  const DEFAULT_PRIME_TTL_MS = 120_000;
  let sendInFlight = false;
  let primedMessage = null;

  function focusedTornPage() {
    return document.visibilityState === 'visible' && document.hasFocus();
  }

  function findContainer() {
    const current = document.querySelector('#faction');
    if (current) return current;
    const exact = [...document.querySelectorAll('[id^="faction-"]')]
      .find(node => node.querySelector(FACTION_COMPOSER_SELECTOR));
    if (exact) return exact;
    return [...document.querySelectorAll('div,section')].find(node => {
      const composer = node.querySelector(FACTION_COMPOSER_SELECTOR);
      const header = node.querySelector('button[data-prevent-flyout-swipe="true"][class*="header___"]');
      return composer && Boolean(header?.querySelector('svg[class*="arrowIcon___"]'));
    }) || null;
  }

  function findLauncher() {
    const currentHeader = document.querySelector('#faction button[data-prevent-flyout-swipe="true"][class*="header___"]');
    if (currentHeader) return currentHeader;
    return [...document.querySelectorAll('button,a,[role="button"]')].find(node => {
      const label = [node.getAttribute?.('aria-label'), node.getAttribute?.('title'), node.textContent]
        .filter(Boolean).join(' ').trim().toLowerCase();
      return label === 'faction' || label.includes('faction chat') || label.includes('open faction');
    }) || null;
  }

  function findComposer(container) {
    return container?.querySelector(FACTION_COMPOSER_SELECTOR) || null;
  }

  function setComposerContent(composer, text) {
    composer.focus();
    if (composer.matches('textarea,input')) {
      const prototype = composer.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
      const setter = Object.getOwnPropertyDescriptor(prototype, 'value')?.set;
      if (setter) setter.call(composer, text); else composer.value = text;
    } else {
      composer.innerHTML = '';
      try { document.execCommand('insertHTML', false, text); }
      catch { composer.textContent = text; }
    }
    try {
      composer.dispatchEvent(new InputEvent('input', { bubbles:true, composed:true, inputType:'insertText', data:text }));
    } catch {
      composer.dispatchEvent(new Event('input', { bubbles:true, composed:true }));
    }
    composer.dispatchEvent(new Event('change', { bubbles:true, composed:true }));
  }

  function normalizedPath(path) {
    return String(path?.getAttribute?.('d') || '').replace(/\s+/g, '');
  }

  function isSendButton(button) {
    if (!button) return false;
    const label = [button.getAttribute?.('aria-label'), button.getAttribute?.('title'), button.textContent]
      .filter(Boolean).join(' ').trim().toLowerCase();
    const sendPath = button.querySelector?.('svg[viewBox="0 0 18 18"] path');
    return normalizedPath(sendPath).startsWith(SEND_ICON_PATH_PREFIX)
      || label === 'send'
      || label.includes('send message');
  }

  function findSendButton(container, composer) {
    const scopes = [...new Set([composer?.parentElement, container].filter(Boolean))];
    for (const scope of scopes) {
      const button = [...scope.querySelectorAll('button,[role="button"]')].find(isSendButton);
      if (button) return button;
    }
    return null;
  }

  function composerContent(composer) {
    if (!composer) return '';
    if (composer.matches?.('textarea,input')) return String(composer.value || '').trim();
    return String(composer.textContent || '').trim();
  }

  async function waitFor(check, timeoutMs, intervalMs = 75) {
    const started = Date.now();
    while (Date.now() - started < timeoutMs) {
      if (!focusedTornPage()) return null;
      const result = check();
      if (result) return result;
      await new Promise(resolve => global.setTimeout(resolve, intervalMs));
    }
    return null;
  }

  function currentPrimed(key = '') {
    if (primedMessage && primedMessage.expiresAt <= Date.now()) primedMessage = null;
    if (!primedMessage) return null;
    return key && primedMessage.key !== String(key) ? null : primedMessage;
  }

  async function copyText(text) {
    try {
      if (global.navigator?.clipboard?.writeText) {
        await global.navigator.clipboard.writeText(text);
        return true;
      }
    } catch {}
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.cssText = 'position:fixed;left:-9999px;top:-9999px';
    document.body.append(textarea);
    textarea.select();
    const copied = document.execCommand('copy');
    textarea.remove();
    return copied;
  }

  async function prime(value, options = {}) {
    const text = String(value || '').trim();
    const key = String(options.key || '');
    if (!text) return { ok:false, label:'Nothing to copy', key };
    const copied = await copyText(text);
    if (!copied) return { ok:false, label:'Copy failed', key };
    const ttlMs = Math.max(1_000, Number(options.ttlMs) || DEFAULT_PRIME_TTL_MS);
    primedMessage = { key, text, expiresAt:Date.now() + ttlMs };
    return { ok:true, label:'Copied', key, expiresAt:primedMessage.expiresAt };
  }

  function isPrimed(key = '') {
    return Boolean(currentPrimed(key));
  }

  function clearPrimed(key = '') {
    if (!key || primedMessage?.key === String(key)) primedMessage = null;
  }

  async function send(value) {
    const text = String(value || '').trim();
    if (!text) return { ok:false, label:'Nothing copied to send' };
    if (sendInFlight) return { ok:false, label:'Faction message already sending' };
    if (!focusedTornPage()) return { ok:false, label:'Focus Torn first' };

    sendInFlight = true;
    try {
      let container = findContainer();
      let composer = findComposer(container);
      if (!container || !composer) {
        const launcher = findLauncher();
        if (!launcher) return { ok:false, label:'Faction Chat not found' };
        launcher.click();
        const found = await waitFor(() => {
          const nextContainer = findContainer();
          const nextComposer = findComposer(nextContainer);
          return nextContainer && nextComposer ? { container:nextContainer, composer:nextComposer } : null;
        }, 2500, 100);
        container = found?.container;
        composer = found?.composer;
      }
      if (!container || !composer) return { ok:false, label:'Faction message box not found' };
      if (!focusedTornPage()) return { ok:false, label:'Focus Torn first' };

      setComposerContent(composer, text);
      const sendButton = await waitFor(() => {
        const button = findSendButton(container, composer);
        return button && !button.disabled && button.getAttribute('aria-disabled') !== 'true' ? button : null;
      }, 1500, 50);
      if (!sendButton || !focusedTornPage()) {
        return { ok:false, label:sendButton ? 'Focus Torn first' : 'Faction send not ready' };
      }

      sendButton.click();
      const cleared = await waitFor(() => composerContent(composer) === '' ? true : null, 1500, 50);
      return cleared
        ? { ok:true, label:'Sent to Faction' }
        : { ok:false, label:'Faction message stayed in the box' };
    } finally {
      sendInFlight = false;
    }
  }

  async function sendPrimed(options = {}) {
    const key = String(options.key || '');
    const message = currentPrimed(key);
    if (!message) return { ok:false, label:'Copy this message first' };
    const result = await send(message.text);
    if (result.ok && primedMessage === message) primedMessage = null;
    return result;
  }

  SLINK.define('core', 'factionChat', Object.freeze({
    clearPrimed,
    isPrimed,
    prime,
    sendPrimed
  }));
})(globalThis);
