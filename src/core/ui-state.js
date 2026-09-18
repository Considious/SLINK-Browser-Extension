(function installUiState(global) {
  'use strict';

  const SLINK = global.SLINK_EXTENSION;
  if (!SLINK) throw new Error('SLINK runtime must load before UI state helpers.');

  function pathFor(root, node) {
    if (!root || !node || node === root) return [];
    const path = [];
    let current = node;
    while (current && current !== root) {
      const parent = current.parentElement;
      if (!parent) return null;
      path.unshift([...parent.children].indexOf(current));
      current = parent;
    }
    return current === root ? path : null;
  }

  function nodeAt(root, path) {
    let current = root;
    for (const index of Array.isArray(path) ? path : []) current = current?.children?.[index] || null;
    return current;
  }

  function keyFor(root, node) {
    const key = node?.dataset?.slinkUiKey;
    if (key) return { key };
    if (node?.id) return { id:node.id };
    return { path:pathFor(root, node) };
  }

  function locate(root, locator) {
    if (!root || !locator) return null;
    if (locator.key) return [...root.querySelectorAll('[data-slink-ui-key]')].find(node => node.dataset.slinkUiKey === locator.key) || null;
    if (locator.id) return [...root.querySelectorAll('[id]')].find(node => node.id === locator.id) || null;
    return nodeAt(root, locator.path);
  }

  function capture(root) {
    if (!root) return null;
    const active = root.contains(document.activeElement) ? document.activeElement : null;
    const controls = [...root.querySelectorAll('[data-slink-preserve],input[type="search"],textarea')].map(node => ({
      locator:keyFor(root, node),
      value:'value' in node ? node.value : node.textContent,
      checked:'checked' in node ? node.checked : undefined,
      selectionStart:Number.isInteger(node.selectionStart) ? node.selectionStart : null,
      selectionEnd:Number.isInteger(node.selectionEnd) ? node.selectionEnd : null
    }));
    const details = [...root.querySelectorAll('details')].map(node => ({ locator:keyFor(root, node), open:node.open }));
    const scroll = [root, ...root.querySelectorAll('[data-slink-preserve-scroll]')].map(node => ({ locator:keyFor(root, node), top:node.scrollTop, left:node.scrollLeft }));
    return { active:active ? keyFor(root, active) : null, controls, details, scroll };
  }

  function restore(root, snapshot) {
    if (!root || !snapshot) return;
    for (const item of snapshot.controls || []) {
      const node = locate(root, item.locator); if (!node) continue;
      if ('value' in node) node.value = item.value;
      else if (node.isContentEditable) node.textContent = item.value;
      if (item.checked !== undefined && 'checked' in node) node.checked = item.checked;
    }
    for (const item of snapshot.details || []) {
      const node = locate(root, item.locator); if (node?.tagName === 'DETAILS') node.open = item.open;
    }
    for (const item of snapshot.scroll || []) {
      const node = locate(root, item.locator); if (node) { node.scrollTop = item.top; node.scrollLeft = item.left; }
    }
    const active = locate(root, snapshot.active);
    if (active?.focus) {
      active.focus({ preventScroll:true });
      const saved = (snapshot.controls || []).find(item => locate(root, item.locator) === active);
      if (saved && saved.selectionStart !== null && typeof active.setSelectionRange === 'function') {
        try { active.setSelectionRange(saved.selectionStart, saved.selectionEnd); } catch {}
      }
    }
  }

  function preserve(root, render) {
    const snapshot = capture(root);
    const result = render();
    restore(root, snapshot);
    return result;
  }

  SLINK.define('core', 'uiState', Object.freeze({ capture, restore, preserve }));
})(globalThis);
