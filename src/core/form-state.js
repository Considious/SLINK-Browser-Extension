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
    if (control.matches('[data-ui-autosave="true"]')) return '';
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
    const revisions = new Map();
    const tickets = new WeakMap();
    let revision = 0;
    let focusedKey = '';
    let restoring = false;
    let scheduled = false;

    function remember(control) {
      const key = controlIdentity(control, root);
      if (!key) return;
      const next = snapshot(control);
      const semantic = value => JSON.stringify(value && { kind:value.kind, value:value.value, checked:value.checked, values:value.values, open:value.open });
      if (semantic(next) !== semantic(dirty.get(key))) revisions.set(key, ++revision);
      dirty.set(key, next);
      if (control === (root.activeElement || document.activeElement)) focusedKey = key;
    }

    function clearScope(element) {
      const scope = element?.matches?.(CONTROL_SELECTOR)
        ? scopeFor(element, root)
        : scopeFor(element?.querySelector?.(CONTROL_SELECTOR) || element, root);
      for (const key of dirty.keys()) if (key.startsWith(`${scope}|`)) dirty.delete(key);
      if (focusedKey.startsWith(`${scope}|`)) focusedKey = '';
    }

    function keysIn(element) {
      const controls = [...(element?.querySelectorAll?.(CONTROL_SELECTOR) || [])];
      if (element?.matches?.(CONTROL_SELECTOR)) controls.unshift(element);
      return [...new Set(controls.map(control => controlIdentity(control, root)).filter(Boolean))];
    }

    function begin(element = root) {
      const ticket = Object.freeze({});
      tickets.set(ticket, new Map(keysIn(element).map(key => [key, revisions.get(key) || 0])));
      return ticket;
    }

    function isCurrent(ticket) {
      const captured = tickets.get(ticket);
      return Boolean(captured && [...captured].every(([key, version]) => (revisions.get(key) || 0) === version));
    }

    function commit(ticket) {
      const captured = tickets.get(ticket);
      if (!captured) return false;
      const current = isCurrent(ticket);
      for (const [key, version] of captured) {
        if ((revisions.get(key) || 0) !== version) continue;
        dirty.delete(key);
        if (focusedKey === key) focusedKey = '';
      }
      tickets.delete(ticket);
      return current;
    }

    function cancel(element = root) {
      for (const key of keysIn(element)) {
        revisions.set(key, ++revision);
        dirty.delete(key);
        if (focusedKey === key) focusedKey = '';
      }
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
      const control = event.target;
      const key = controlIdentity(control, root);
      queueMicrotask(() => {
        if (!control.isConnected) return;
        const active = root.activeElement || document.activeElement;
        if (focusedKey === key && active !== control) focusedKey = '';
      });
    }

    function onClick(event) {
      const signature = actionSignature(event.target);
      if (!signature || !COMMIT_ACTION.test(signature)) return;
      const action = event.target.closest('button, input, [role="button"]');
      if (action?.closest?.('[data-ui-explicit-commit="true"]')) return;
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
    function mutationNeedsRestore(mutations) {
      return mutations.some(mutation => [...mutation.addedNodes].some(node => node?.nodeType === 1
        && (node.matches?.(CONTROL_SELECTOR) || node.querySelector?.(CONTROL_SELECTOR))));
    }
    const observer = new MutationObserver(mutations => { if (mutationNeedsRestore(mutations)) scheduleRestore(); });
    observer.observe(root, { childList:true, subtree:true });

    const api = Object.freeze({
      begin, commit, cancel, isCurrent,
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

  function autosave({ root, fields, read, save, select = value => value, onCommit = () => {}, onState = () => {}, delay = 600 }) {
    if (!root?.addEventListener || typeof read !== 'function' || typeof save !== 'function') throw new TypeError('Autosave needs a root, current-value reader and save function.');
    const guard = protect(root.getRootNode?.() || root);
    const dirty = new Map(), timers = new Map(), errors = new Map(), applied = new Map();
    const requests = new Set();
    let sequence = 0, revision = 0, stopped = false, saved = false;
    let stopPromise = null;
    const controlFor = id => root.querySelector('#'+cssEscape(id));
    const same = (a,b) => String(a) === String(b);
    const state = () => ({
      state:timers.size || requests.size ? 'saving' : [...dirty.values()].some(row => !row.valid) ? 'invalid' : errors.size ? 'failed' : dirty.size ? 'unsaved' : saved ? 'saved' : 'idle',
      pending:timers.size + requests.size,
      error:[...errors.values()].at(-1)?.error || ''
    });
    const emit = () => { if (!stopped) onState(state()); };
    function remember(control) {
      if (!Object.hasOwn(fields,control?.id)) return null;
      const key = fields[control?.id];
      if (!key || !root.contains(control) || !control.matches?.('input, textarea, select')) return null;
      const value = control.type === 'checkbox' ? control.checked : control.value;
      const valid = control.type !== 'number' || (String(value).trim() !== '' && Number.isFinite(Number(value)));
      const previous = dirty.get(control.id);
      const row = previous && same(previous.value,value) && previous.valid === valid ? previous : { value, valid, revision:++revision };
      dirty.set(control.id,row);
      return row;
    }
    function clearTimer(id) { if (timers.has(id)) global.clearTimeout(timers.get(id)); timers.delete(id); }
    function submit(id) {
      clearTimer(id);
      const row = dirty.get(id), control = controlFor(id), key = fields[id];
      if (!row) return Promise.resolve();
      if (!row.valid) { emit(); return Promise.reject(new Error('Enter a valid number before continuing.')); }
      const ticket = control ? guard?.begin(control) : null;
      const active = [...requests].filter(request => request.id === id);
      const duplicate = [...active].reverse().find(request => same(request.value,row.value));
      if (duplicate && duplicate === active.at(-1)) {
        if (ticket) duplicate.tickets.push(ticket);
        duplicate.revision = row.revision;
        return duplicate.promise;
      }
      if (!active.length && same(row.value,read(key))) {
        if (ticket) guard.commit(ticket);
        dirty.delete(id);errors.delete(id);saved=true;emit();return Promise.resolve();
      }
      const request = { id, key, value:row.value, revision:row.revision, sequence:++sequence, tickets:ticket ? [ticket] : [] };
      requests.add(request);
      request.promise = (async () => {
        try {
          const response = await save({ [key]:row.value });
          const values = select(response);
          if (!values || !Object.hasOwn(values,key)) throw new Error('Settings save was not acknowledged.');
          const acknowledged = values[key];
          if (acknowledged === undefined || (control?.type === 'checkbox' && typeof acknowledged !== 'boolean')
            || (control?.type === 'number' && (acknowledged === null || String(acknowledged).trim()==='' || !Number.isFinite(Number(acknowledged))))) throw new Error('Settings save returned an invalid value.');
          let unchanged = !guard;
          for (const captured of request.tickets) if (guard.commit(captured)) unchanged = true;
          if (request.sequence >= (applied.get(id) || 0)) {
            applied.set(id,request.sequence);
            if (!stopped) onCommit({ [key]:values[key] },response);
            if (!stopped && unchanged) {
              const current = controlFor(id);
              if (current?.type === 'checkbox') current.checked = values[key] === true;
              else if (current && current.value !== String(values[key] ?? '')) current.value = String(values[key] ?? '');
            }
          }
          if (dirty.get(id)?.revision === request.revision) dirty.delete(id);
          if ((errors.get(id)?.sequence || 0) <= request.sequence) errors.delete(id);
          saved=true;
        } catch (error) {
          if (request.sequence >= (applied.get(id) || 0)) errors.set(id,{sequence:request.sequence,error:String(error?.message || error)});
          throw error;
        } finally { requests.delete(request);emit(); }
      })();
      emit();
      return request.promise;
    }
    function onInput(event) {
      if (stopped || !Object.hasOwn(fields,event.target?.id) || event.target.type === 'checkbox' || event.target.tagName === 'SELECT') return;
      const row = remember(event.target);if (!row) return;
      clearTimer(event.target.id);
      if (row.valid) {
        const id = event.target.id;
        timers.set(id,global.setTimeout(() => { timers.delete(id);void submit(id).catch(() => {}); },delay));
      }
      emit();
    }
    function onChange(event) {
      if (stopped || !remember(event.target)) return;
      void submit(event.target.id).catch(() => {});
    }
    function onBlur(event) {
      if (stopped || !Object.hasOwn(fields,event.target?.id) || !dirty.has(event.target.id)) return;
      void submit(event.target.id).catch(() => {});
    }
    async function flush() {
      const writes = [...dirty.keys()].map(id => submit(id));
      const results = await Promise.allSettled([...writes,...[...requests].map(request => request.promise)]);
      const failed = results.find(result => result.status === 'rejected');
      if (failed) throw failed.reason;
      if (errors.size) throw new Error(state().error);
    }
    const onPageHide = () => { void flush().catch(() => {}); };
    root.addEventListener('input',onInput);
    root.addEventListener('change',onChange);
    root.addEventListener('focusout',onBlur);
    global.addEventListener?.('pagehide',onPageHide);
    return Object.freeze({
      flush, retry:flush, state,
      mount() {
        // Let the existing form guard restore retained local drafts first.
        // This is not cloud recovery and never touches unregistered controls.
        queueMicrotask(() => queueMicrotask(() => {
          if (stopped) return;
          for (const id of Object.keys(fields)) {
            const control=controlFor(id);if(!control)continue;
            const value=control.type==='checkbox'?control.checked:control.value;
            const model=read(fields[id]);
            if (model===undefined||model===null||same(value,model)) continue;
            if (control.type==='checkbox'||control.tagName==='SELECT') onChange({target:control});
            else onInput({target:control});
          }
        }));
      },
      get busy() { return timers.size > 0 || requests.size > 0; },
      stop() {
        if (stopPromise) return stopPromise;
        const completion = flush();
        stopped=true;
        root.removeEventListener('input',onInput);root.removeEventListener('change',onChange);root.removeEventListener('focusout',onBlur);
        global.removeEventListener?.('pagehide',onPageHide);
        for (const id of [...timers.keys()]) clearTimer(id);
        stopPromise = completion.catch(() => {});
        return stopPromise;
      }
    });
  }

  SLINK.define('core', 'formState', Object.freeze({ protect, controlIdentity, autosave }));
})(globalThis);

