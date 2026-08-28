(async function startSlinkContent(global) {
  'use strict';

  if (global.__SLINK_EXTENSION_CONTENT_STARTED__) return;
  Object.defineProperty(global, '__SLINK_EXTENSION_CONTENT_STARTED__', { value:true });
  const SLINK = global.SLINK_EXTENSION;
  const ui = SLINK.core.uiShell.createShell({ title:'SLINK', subtitle:'Shared Live Intelligence NetworK' });
  let initialized = false;
  let restarting = null;

  ui.setHidden(await SLINK.core.storage.get('ui.pagePanelHidden', false));

  async function modulePresentation(module) {
    if (module.id !== 'war') {
      return await SLINK.core.storage.get(`ui.modules.${module.id}.showInTorn`, module.defaultShowInTorn)
        ? 'full'
        : 'hidden';
    }
    const settings = await SLINK.core.storage.get('war.settings.v1', {});
    if (settings.displayMode === 'extension') return 'headless-extension';
    if (settings.displayMode === 'hybrid') return 'headless';
    return 'full';
  }

  async function startModules(permissions) {
    return SLINK.modules.startAll({
      url:new URL(global.location.href),
      permissions,
      ui,
      modulePresentation,
      moduleVisible: module => SLINK.core.storage.get(`ui.modules.${module.id}.showInTorn`, module.defaultShowInTorn)
    });
  }

  async function reloadThemeAndPermissions() {
    const [permissions, themeRecord] = await Promise.all([
      SLINK.core.messaging.send('permissions.get'),
      SLINK.core.messaging.send('themes.catalog').catch(() => null)
    ]);
    if (themeRecord?.catalog) SLINK.core.themes.installCatalog(themeRecord.catalog);
    const preferredTheme = await SLINK.core.storage.get(
      SLINK.core.themes.STORAGE_KEY,
      SLINK.core.themes.DEFAULT_THEME_ID
    );
    ui.setTheme(preferredTheme, permissions);
    return permissions;
  }

  async function restartModules({ restore = false } = {}) {
    if (restarting) return restarting;
    restarting = (async () => {
      await SLINK.modules.stopAll();
      if (restore) await ui.restore();
      const permissions = await reloadThemeAndPermissions();
      const result = await startModules(permissions);
      if (restore) await ui.restore();
      return { restored:restore, ...result };
    })();
    try { return await restarting; }
    finally { restarting = null; }
  }

  // SLINK must never navigate or refresh Torn. Storage changes are applied in
  // place where that is safe; everything else waits for normal user navigation.
  chrome.storage.onChanged.addListener(changes => {
    const hiddenKey = SLINK.core.storage.fullKey('ui.pagePanelHidden');
    if (changes[hiddenKey]) ui.setHidden(Boolean(changes[hiddenKey].newValue));
    const collapsedKey = SLINK.core.storage.fullKey('ui.main.collapsed');
    if (changes[collapsedKey]) void ui.setCollapsed(Boolean(changes[collapsedKey].newValue), false);
    const levelingVisibilityKey = SLINK.core.storage.fullKey('ui.modules.leveling.showInTorn');
    const warSettingsKey = SLINK.core.storage.fullKey('war.settings.v1');
    if (initialized && (changes[levelingVisibilityKey] || changes[warSettingsKey])) {
      void restartModules().catch(error => console.error('[SLINK] Could not apply the Torn GUI mode in place:', error));
    }
    const permissionsKey = SLINK.core.storage.fullKey('permissions.snapshot');
    const themeKey = SLINK.core.storage.fullKey(SLINK.core.themes.STORAGE_KEY);
    const catalogKey = SLINK.core.storage.fullKey(SLINK.core.themes.CATALOG_STORAGE_KEY);
    if (changes[catalogKey]?.newValue?.catalog) {
      try { SLINK.core.themes.installCatalog(changes[catalogKey].newValue.catalog); }
      catch (error) { console.error('[SLINK] Rejected invalid cached theme catalog:', error); }
    }
    if (changes[themeKey] || changes[permissionsKey] || changes[catalogKey]) {
      void Promise.all([
        SLINK.core.storage.get(SLINK.core.themes.STORAGE_KEY, SLINK.core.themes.DEFAULT_THEME_ID),
        SLINK.core.messaging.send('permissions.get')
      ]).then(([themeId, permissions]) => {
        ui.setTheme(themeId, permissions);
      }).catch(error => {
        console.error('[SLINK] Could not update the theme in place:', error);
      });
    }
  });

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.channel !== 'slink-ui-control' || message?.type !== 'restore') return false;
    void restartModules({ restore:true })
      .then(result => sendResponse({ ok:true, ...result }))
      .catch(error => sendResponse({ ok:false, error:SLINK.core.format.errorMessage(error) }));
    return true;
  });

  try {
    await SLINK.core.messaging.send('content.ready', { url:global.location.href });
    const permissions = await reloadThemeAndPermissions();
    await startModules(permissions);
    initialized = true;
  } catch (error) {
    console.error('[SLINK] Content startup:', error);
  }
})(globalThis);
