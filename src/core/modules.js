(function installModules(global) {
  'use strict';

  const SLINK = global.SLINK_EXTENSION;
  if (!SLINK) throw new Error('SLINK runtime must load before modules.');

  const registry = new Map();
  const running = new Map();

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

  async function startAll(context) {
    const started = [];
    const denied = [];
    const skipped = [];
    const failed = [];
    const planned = [];

    for (const module of registry.values()) {
      if (running.has(module.id)) {
        skipped.push({ id: module.id, reason: 'already-running' });
        continue;
      }
      if (!module.matches(context.url)) {
        skipped.push({ id: module.id, reason: 'url-mismatch' });
        continue;
      }
      if (!SLINK.core.permissions.hasAllScopes(context.permissions, module.requiredScopes)) {
        denied.push({ id: module.id, requiredScopes: [...module.requiredScopes] });
        continue;
      }
      if (module.permissionTest && !module.permissionTest(context.permissions)) {
        denied.push({ id:module.id, requiredScopes:['slink.adhd.marketwatch.<tier>'] });
        continue;
      }

      const presentation = typeof context.modulePresentation === 'function'
        ? await context.modulePresentation(module)
        : (typeof context.moduleVisible === 'function' && !await context.moduleVisible(module) ? 'hidden' : 'full');
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
      try {
        const instance = await module.start({ ...context, module, ui:moduleUi, presentation });
        running.set(module.id, { module, instance, moduleUi });
        started.push(module.id);
      } catch (error) {
        const message = SLINK.core.format.errorMessage(error);
        moduleUi?.setStatus?.(message, 'error');
        // Retain the failed view so stopAll can remove it during an in-page
        // module restart instead of leaving a duplicate tab behind.
        running.set(module.id, { module, instance:null, moduleUi, startFailed:true });
        failed.push({ id:module.id, error:message });
      }
    }));

    return { started, denied, skipped, failed };
  }

  async function stopAll() {
    for (const [id, entry] of [...running.entries()].reverse()) {
      if (entry.module.stop) await entry.module.stop(entry.instance);
      else if (typeof entry.instance?.stop === 'function') await entry.instance.stop();
      if (typeof entry.moduleUi?.remove === 'function') entry.moduleUi.remove();
      running.delete(id);
    }
  }

  SLINK.define('modules', 'register', register);
  SLINK.define('modules', 'list', list);
  SLINK.define('modules', 'startAll', startAll);
  SLINK.define('modules', 'stopAll', stopAll);
})(globalThis);
