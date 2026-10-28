(function installClipboard(global) {
  'use strict';
  async function copyText(value) {
    const text = String(value ?? '');
    if (!text) return false;
    try {
      if (global.navigator?.clipboard?.writeText) { await global.navigator.clipboard.writeText(text); return true; }
    } catch {}
    let field;
    const document = global.document;
    if (!document?.body || typeof document.execCommand !== 'function') return false;
    let focused = document.activeElement;
    while (focused?.shadowRoot?.activeElement) focused = focused.shadowRoot.activeElement;
    const start = focused?.selectionStart, end = focused?.selectionEnd, direction = focused?.selectionDirection;
    try {
      field = document.createElement('textarea');
      field.value = text;
      field.readOnly = true;
      field.style.cssText = 'position:fixed;left:-9999px;top:-9999px';
      document.body.append(field);
      field.select();
      return document.execCommand('copy') === true;
    } catch { return false; }
    finally {
      field?.remove();
      if (focused?.isConnected) {
        try { focused.focus({ preventScroll:true }); if (typeof start === 'number') focused.setSelectionRange?.(start,end,direction); } catch {}
      }
    }
  }
  global.SLINK_EXTENSION.define('core','clipboard',Object.freeze({copyText}));
})(globalThis);
