(function installFormState(global) {
  'use strict';

  const SLINK = global.SLINK_EXTENSION;
  if (!SLINK) throw new Error('SLINK runtime missing');

  const CONTROL_SELECTOR = 'input, textarea, select, [contenteditable="true"], details';
  const PANEL_STATE_KEY = 'ui.interaction.panels.v1';
  const COMMIT_ACTION = /(?:^|[-_\s])(save|submit|apply|update|confirm|cancel|reset|clear|remove|delete)(?:$|[-_\s])/i;
  const protectedRoots = new WeakMap();
  const panelStates = new Map();
  let panelStatesLoaded = false;

  async function loadPanelStates() {
    if (panelStatesLoaded) return;
    panelStatesLoaded = true;
    try {
      const saved = await SLINK.core.storage?.get(PANEL_STATE_KEY, {});
      for (const [key, open] of Object.entries(saved && typeof saved === 'object' ? saved : {})) panelStates.set(key, Boolean(open));
    } catch {}
  }

  function persistPanelStates() {
    const saved = Object.fromEntries(panelStates);
    void SLINK.core.storage?.set(PANEL_STATE_KEY, saved).catch?.(() => {});
  }

  function cssEscape(value) {
    if (global.CSS?.escape) return global.CSS.escape(String(value));
    return String(value).replace(/(["\\])/g, '\\$1');
  }

  function scopeFor(control, root) {
    const scoped = control.closest?.('[data-slink-module-id], [data-dashboard-page], form[id]');
    if (!scoped || (root instanceof Element && !root.contains(scoped))) return 'root';
    if (scoped.dataset?.slinkModuleId) return `module:${scoped.dataset.slinkModuleId}`;
    if (scoped.dataset?.dashboardPage) return `page:${scoped.dataset.dashboardPage}`;
    if (scoped.id) return `form:${scoped.id}`;
    return 'root';
  }

  function stableDataIdentity(control) {
    const preferred = [
      'uiKey', 'field', 'setting', 'key', 'scope', 'targetListTag', 'targetId',
      'watchId', 'marketWatchId', 'alertType', 'action'
    ];
    for (const name of preferred) {
      if (control.dataset?.[name] !== undefined) return `data-${name}:${control.dataset[name]}`;
    }
    const candidate = Object.entries(control.dataset || {})
      .find(([name, value]) => name !== 'slinkFormState' && value !== '' && /(?:field|key|id|type|scope)$/i.test(name));
    return candidate ? `data-${candidate[0]}:${candidate[1]}` : '';
  }

  function controlIdentity(control, root) {
    if (!control?.matches?.(CONTROL_SELECTOR)) return '';
    const scope = scopeFor(control, root);
    if (control.id) return `${scope}|id:${control.id}`;
    if (control.name) return `${scope}|name:${control.name}`;
    const dataIdentity = stableDataIdentity(control);
    if (dataIdentity) return `${scope}|${dataIdentity}`;
    const container = control.closest?.('label, .field, .setting, .control') || control.parentElement;
    const siblings = [...(container?.querySelectorAll?.(CONTROL_SELECTOR) || [])];
    const localIndex = Math.max(0, siblings.indexOf(control));
    const label = String(container?.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 80);
    return `${scope}|${control.tagName.toLowerCase()}:${String(control.type || '')}:${label}:${localIndex}`;
  }

  function snapshot(control) {
    if (control.tagName === 'DETAILS') return { kind:'open', open:control.open };
    if (control.matches('[contenteditable="true"]')) return { kind:'html', value:control.innerHTML };
    if (control instanceof HTMLInputElement && (control.type === 'checkbox' || control.type === 'radio')) {
      return { kind:'checked', checked:control.checked };
    }
    if (control instanceof HTMLSelectElement && control.multiple) {
      return { kind:'multiple', values:[...control.selectedOptions].map(option => option.value) };
    }
    return {
      kind:'value',
      value:control.value,
      selectionStart:Number.isInteger(control.selectionStart) ? control.selectionStart : null,
      selectionEnd:Number.isInteger(control.selectionEnd) ? control.selectionEnd : null,
      selectionDirection:control.selectionDirection || 'none'
    };
  }

  function applySnapshot(control, state) {
    if (!control || !state) return;
    if (state.kind === 'open') control.open = Boolean(state.open);
    else if (state.kind === 'html') control.innerHTML = state.value;
    else if (state.kind === 'checked') control.checked = Boolean(state.checked);
    else if (state.kind === 'multiple') {
      const selected = new Set(state.values || []);
      [...control.options].forEach(option => { option.selected = selected.has(option.value); });
    } else control.value = state.value ?? '';
  }

  function actionSignature(element) {
    const action = element?.closest?.('button, input[type="submit"], input[type="reset"], [role="button"]');
    if (!action) return '';
    return [action.id, action.name, action.dataset?.action, action.value, action.textContent]
      .filter(Boolean).join(' ').trim();
  }

  function protect(root) {
    if (!root?.addEventListener || !root?.querySelectorAll) return null;
    if (protectedRoots.has(root)) return protectedRoots.get(root);
    const dirty = new Map();
    let focusedKey = '';
    let restoring = false;
    let scheduled = false;

    function remember(control) {
      const key = controlIdentity(control, root);
      if (!key) return;
      dirty.set(key, snapshot(control));
      if (control === (root.activeElement || document.activeElement)) focusedKey = key;
    }

    function clearScope(element) {
      const scope = element?.matches?.(CONTROL_SELECTOR)
        ? scopeFor(element, root)
        : scopeFor(element?.querySelector?.(CONTROL_SELECTOR) || element, root);
      for (const key of dirty.keys()) if (key.startsWith(`${scope}|`)) dirty.delete(key);
      if (focusedKey.startsWith(`${scope}|`)) focusedKey = '';
    }

    function restore() {
      scheduled = false;
      if (restoring || (!dirty.size && !panelStates.size)) return;
      restoring = true;
      const scrollX = Number(global.scrollX) || 0;
      const scrollY = Number(global.scrollY) || 0;
      let focusTarget = null;
      for (const panel of root.querySelectorAll('details[data-ui-key]')) {
        const key = String(panel.dataset.uiKey || '');
        if (key && panelStates.has(key)) panel.open = panelStates.get(key);
      }
      for (const control of root.querySelectorAll(CONTROL_SELECTOR)) {
        const key = controlIdentity(control, root);
        const state = dirty.get(key);
        if (!state) continue;
        applySnapshot(control, state);
        if (key === focusedKey) focusTarget = control;
      }
      if (focusTarget && focusTarget.isConnected) {
        try {
          focusTarget.focus({ preventScroll:true });
          const state = dirty.get(focusedKey);
          if (state?.kind === 'value' && state.selectionStart !== null && focusTarget.setSelectionRange) {
            focusTarget.setSelectionRange(state.selectionStart, state.selectionEnd, state.selectionDirection);
          }
          global.scrollTo?.(scrollX, scrollY);
        } catch {}
      }
      restoring = false;
    }

    function scheduleRestore() {
      if (scheduled || (!dirty.size && !panelStates.size)) return;
      scheduled = true;
      queueMicrotask(restore);
    }

    function onEdit(event) {
      if (restoring || !event.target?.matches?.(CONTROL_SELECTOR)) return;
      remember(event.target);
    }

    function onFocusIn(event) {
      if (!event.target?.matches?.(CONTROL_SELECTOR)) return;
      focusedKey = controlIdentity(event.target, root);
      if (dirty.has(focusedKey)) remember(event.target);
    }

    function onFocusOut(event) {
      if (!event.target?.matches?.(CONTROL_SELECTOR)) return;
      const key = controlIdentity(event.target, root);
      queueMicrotask(() => {
        if (!event.target.isConnected) return;
        const active = root.activeElement || document.activeElement;
        if (focusedKey === key && active !== event.target) focusedKey = '';
      });
    }

    function onClick(event) {
      const signature = actionSignature(event.target);
      if (!signature || !COMMIT_ACTION.test(signature)) return;
      const action = event.target.closest('button, input, [role="button"]');
      global.setTimeout(() => clearScope(action), 0);
    }

    function onToggle(event) {
      if (restoring || event.target?.tagName !== 'DETAILS') return;
      remember(event.target);
      const key = String(event.target.dataset?.uiKey || '');
      if (key) {
        panelStates.set(key, event.target.open);
        persistPanelStates();
      }
    }

    root.addEventListener('input', onEdit, true);
    root.addEventListener('change', onEdit, true);
    root.addEventListener('toggle', onToggle, true);
    root.addEventListener('focusin', onFocusIn, true);
    root.addEventListener('focusout', onFocusOut, true);
    root.addEventListener('click', onClick, true);
    const observer = new MutationObserver(scheduleRestore);
    observer.observe(root, { childList:true, subtree:true });

    const api = Object.freeze({
      clear(element = root) { clearScope(element); },
      restore,
      stop() {
        observer.disconnect();
        root.removeEventListener('input', onEdit, true);
        root.removeEventListener('change', onEdit, true);
        root.removeEventListener('toggle', onToggle, true);
        root.removeEventListener('focusin', onFocusIn, true);
        root.removeEventListener('focusout', onFocusOut, true);
        root.removeEventListener('click', onClick, true);
        protectedRoots.delete(root);
      }
    });
    protectedRoots.set(root, api);
    void loadPanelStates().then(scheduleRestore);
    return api;
  }

  SLINK.define('core', 'formState', Object.freeze({ protect, controlIdentity }));
})(globalThis);

