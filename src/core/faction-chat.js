(function installFactionChat(global) {
  'use strict';

  const SLINK = global.SLINK_EXTENSION;
  if (!SLINK) throw new Error('SLINK runtime must load before Faction Chat helpers.');

  function focusedTornPage() {
    return document.visibilityState === 'visible' && document.hasFocus();
  }

  function findContainer() {
    const exact = [...document.querySelectorAll('[id^="faction-"]')]
      .find(node => node.querySelector('textarea[placeholder="Type your message here..."],textarea[class*="textarea"]'));
    if (exact) return exact;
    return [...document.querySelectorAll('div,section')].find(node => {
      const title = node.querySelector('button span,header span');
      const composer = node.querySelector('textarea[placeholder*="message" i],[contenteditable="true"]');
      return composer && String(title?.textContent || '').trim().toLowerCase() === 'faction';
    }) || null;
  }

  function findLauncher() {
    return [...document.querySelectorAll('button,a,[role="button"]')].find(node => {
      const label = [node.getAttribute?.('aria-label'), node.getAttribute?.('title'), node.textContent]
        .filter(Boolean).join(' ').trim().toLowerCase();
      return label === 'faction' || label.includes('faction chat') || label.includes('open faction');
    }) || null;
  }

  function findComposer(container) {
    return container?.querySelector('textarea[placeholder="Type your message here..."],textarea[class*="textarea"],textarea,[contenteditable="true"]') || null;
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

  function findSendButton(container, composer) {
    const sibling = composer?.parentElement?.querySelector('button');
    if (sibling) return sibling;
    return [...(container?.querySelectorAll('button,[role="button"]') || [])].find(button => {
      const label = [button.getAttribute('aria-label'), button.getAttribute('title'), button.textContent]
        .filter(Boolean).join(' ').trim().toLowerCase();
      return button.type === 'submit' || label === 'send' || label.includes('send message') || Boolean(button.querySelector('svg[viewBox="0 0 18 18"]'));
    }) || null;
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

  async function send(value) {
    const text = String(value || '').trim();
    if (!text) return { ok:false, label:'Nothing copied to send' };
    if (!focusedTornPage()) return { ok:false, label:'Focus Torn first' };
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
    return { ok:true, label:'Sent to Faction' };
  }

  SLINK.define('core', 'factionChat', Object.freeze({ send }));
})(globalThis);

