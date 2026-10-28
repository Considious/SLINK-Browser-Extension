(function installModules(global) {
  'use strict';

  const SLINK = global.SLINK_EXTENSION;
  if (!SLINK) throw new Error('SLINK runtime must load before modules.');

  const registry = new Map();
  const running = new Map();
  let generation = 0;

  function bindAction(button, action, { active = () => true, onError = error => console.error('[SLINK] Action:', error) } = {}) {
    let pending = false;
    const listener = event => {
      if (pending || button.disabled || !active() || typeof action.onClick !== 'function') return;
      const target = event.target;
      const captured = new Proxy(event, { get(source, key) {
        if (key === 'currentTarget') return button;
        if (key === 'target') return target;
        const value = Reflect.get(source, key, source);
        return typeof value === 'function' ? value.bind(source) : value;
      } });
      pending = true;
      button.disabled = true;
      const release = () => { pending = false; button.disabled = Boolean(action.disabled); };
      try {
        // Invoke within the original user gesture, not a deferred microtask.
        Promise.resolve(action.onClick(captured)).catch(error => { if (active()) onError(error); }).finally(release);
      } catch (error) { release(); if (active()) onError(error); }
    };
    button.addEventListener('click', listener);
    return () => button.removeEventListener('click', listener);
  }

  function lifecycle(context) {
    const controller = new AbortController();
    const callbacks = [];
    const active = () => !controller.signal.aborted && context.isActive?.() !== false;
    const listen = (target, type, callback, options) => {
      const guarded = (...args) => { if (active()) return callback(...args); };
      target.addEventListener(type, guarded, options);
      callbacks.push(() => target.removeEventListener(type, guarded, options));
    };
    // The real shell freezes its API. Proxy an empty facade so guarded methods
    // do not violate JavaScript's non-configurable-property invariants.
    const ui = context.ui && new Proxy({}, { get(_facade, key) {
      const target = context.ui;
      const value = target[key];
      if (typeof value !== 'function') return value;
      return (...args) => {
        if (/^(?:set|render|update)/.test(String(key)) && !active()) return;
        if (key === 'setActions') args[0] = (args[0] || []).map(action => ({ ...action,
          onClick:(...events) => { if (active()) return action.onClick?.(...events); }
        }));
        return value.apply(target, args);
      };
    } });
    return {
      context:{ ...context, ui, signal:controller.signal, isActive:active, listen },
      dispose() {
        if (controller.signal.aborted) return;
        controller.abort();
        for (const callback of callbacks.splice(0)) callback();
      }
    };
  }

  function stopEntry(entry) {
    if (entry.stopping) return entry.stopping;
    if (!entry.instance) return Promise.resolve();
    // Invoke immediately so synchronous observer/timer cleanup is not queued
    // behind unrelated module startup. Retain the promise for idempotent await.
    try {
      entry.stopping = Promise.resolve(entry.module.stop
        ? entry.module.stop(entry.instance) : entry.instance.stop?.());
    } catch (error) { entry.stopping = Promise.reject(error); }
    return entry.stopping;
  }

  function invalidate() {
    generation += 1;
    for (const entry of running.values()) {
      entry.lifecycle?.dispose();
      void stopEntry(entry).catch(error => console.error('[SLINK] Module cleanup:', entry.module.id, error));
    }
  }

  function register(definition) {
    const id = String(definition?.id || '').trim();
    if (!id) throw new Error('A SLINK module ID is required.');
    if (registry.has(id)) throw new Error(`SLINK module ${id} is already registered.`);
    if (typeof definition.start !== 'function') throw new Error(`SLINK module ${id} requires a start function.`);

    const normalized = Object.freeze({
      id,
      title: String(definition.title || id),
      shortTitle:String(definition.shortTitle || definition.title || id),
      group:String(definition.group || 'other'),
      groupTitle:String(definition.groupTitle || definition.group || 'Other'),
      defaultShowInTorn: definition.defaultShowInTorn !== false,
      requiredScopes: Object.freeze([...(definition.requiredScopes || [])]),
      permissionTest: typeof definition.permissionTest === 'function' ? definition.permissionTest : null,
      matches: typeof definition.matches === 'function' ? definition.matches : () => true,
      start: definition.start,
      stop: typeof definition.stop === 'function' ? definition.stop : null
    });
    registry.set(id, normalized);
    return normalized;
  }

  function list() {
    return [...registry.values()];
  }

  function canAccess(module, permissions) {
    return Boolean(module && SLINK.core.permissions.hasAllScopes(permissions, module.requiredScopes || [])
      && (!module.permissionTest || module.permissionTest(permissions)));
  }

  async function startAll(context) {
    const startedGeneration = generation;
    const current = () => startedGeneration === generation && context.isActive?.() !== false;
    const started = [];
    const denied = [];
    const skipped = [];
    const failed = [];
    const planned = [];

    for (const module of registry.values()) {
      if (!current()) break;
      if (running.has(module.id)) {
        skipped.push({ id: module.id, reason: 'already-running' });
        continue;
      }
      if (!module.matches(context.url)) {
        skipped.push({ id: module.id, reason: 'url-mismatch' });
        continue;
      }
      if (!canAccess(module, context.permissions)) {
        denied.push({ id: module.id, requiredScopes: [...module.requiredScopes] });
        continue;
      }

      const presentation = typeof context.modulePresentation === 'function'
        ? await context.modulePresentation(module)
        : (typeof context.moduleVisible === 'function' && !await context.moduleVisible(module) ? 'hidden' : 'full');
      if (!current()) break;
      if (presentation === 'hidden') {
        skipped.push({ id: module.id, reason: 'hidden-by-user' });
        continue;
      }

      try {
        const moduleUi = presentation === 'full' && context.ui?.createModuleView
          ? await context.ui.createModuleView(module)
          : context.ui;
        if (presentation === 'full') moduleUi?.setStatus?.('Loading saved state…');
        planned.push({ module, presentation, moduleUi });
      } catch (error) {
        failed.push({ id:module.id, error:SLINK.core.format.errorMessage(error) });
      }
    }

    // Create every permitted tab before starting any module. Module starts can
    // perform network or storage work, so running them one-by-one made later
    // tabs appear missing (and left the shell looking stuck on an earlier tab).
    await Promise.all(planned.map(async ({ module, presentation, moduleUi }) => {
      if (!current()) return;
      const scope = lifecycle({ ...context, module, ui:moduleUi, presentation });
      const entry = { module, instance:null, moduleUi, lifecycle:scope };
      running.set(module.id, entry);
      try {
        const instance = await module.start(scope.context);
        entry.instance = instance;
        if (!current() || scope.context.signal.aborted) {
          scope.dispose();
          await stopEntry(entry);
          if (running.get(module.id) === entry) running.delete(module.id);
          return;
        }
        started.push(module.id);
      } catch (error) {
        scope.dispose();
        if (!current()) { if (running.get(module.id) === entry) running.delete(module.id); return; }
        const message = SLINK.core.format.errorMessage(error);
        moduleUi?.setStatus?.(message, 'error');
        // Retain the failed view so stopAll can remove it during an in-page
        // module restart instead of leaving a duplicate tab behind.
        entry.startFailed = true;
        failed.push({ id:module.id, error:message });
      }
    }));

    return { started, denied, skipped, failed };
  }

  async function stopAll(options = {}) {
    const preserveUi = Boolean(options.preserveUi);
    invalidate();
    for (const [id, entry] of [...running.entries()].reverse()) {
      running.delete(id);
      try {
        await stopEntry(entry);
      } catch (error) { console.error('[SLINK] Module cleanup:', id, error); }
      finally { if (!preserveUi && typeof entry.moduleUi?.remove === 'function') entry.moduleUi.remove(); }
    }
  }

  SLINK.define('modules', 'register', register);
  SLINK.define('modules', 'bindAction', bindAction);
  SLINK.define('modules', 'list', list);
  SLINK.define('modules', 'canAccess', canAccess);
  SLINK.define('modules', 'lifecycle', lifecycle);
  SLINK.define('modules', 'invalidate', invalidate);
  SLINK.define('modules', 'startAll', startAll);
  SLINK.define('modules', 'stopAll', stopAll);
})(globalThis);
