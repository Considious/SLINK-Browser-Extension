(async function startSlinkContent(global) {
  'use strict';

  if (global.__SLINK_EXTENSION_CONTENT_STARTED__) return;
  Object.defineProperty(global, '__SLINK_EXTENSION_CONTENT_STARTED__', { value:true });
  const SLINK = global.SLINK_EXTENSION;
  const ui = SLINK.core.uiShell.createShell({ title:'SLINK', subtitle:'Shared Live Intelligence NetworK' });

  ui.setHidden(await SLINK.core.storage.get('ui.pagePanelHidden', false));

  // SLINK must never navigate or refresh Torn. Storage changes are applied in
  // place where that is safe; everything else waits for normal user navigation.
  chrome.storage.onChanged.addListener(changes => {
    const hiddenKey = SLINK.core.storage.fullKey('ui.pagePanelHidden');
    if (changes[hiddenKey]) ui.setHidden(Boolean(changes[hiddenKey].newValue));
    const collapsedKey = SLINK.core.storage.fullKey('ui.main.collapsed');
    if (changes[collapsedKey]) void ui.setCollapsed(Boolean(changes[collapsedKey].newValue), false);
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

  try {
    await SLINK.core.messaging.send('content.ready', { url:global.location.href });
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
    await SLINK.modules.startAll({
      url:new URL(global.location.href),
      permissions,
      ui,
      modulePresentation: async module => {
        if (module.id !== 'war') {
          return await SLINK.core.storage.get(`ui.modules.${module.id}.showInTorn`, module.defaultShowInTorn)
            ? 'full'
            : 'hidden';
        }
        const settings = await SLINK.core.storage.get('war.settings.v1', {});
        if (settings.displayMode === 'extension') return 'headless-extension';
        if (settings.displayMode === 'hybrid') return 'headless';
        return 'full';
      },
      moduleVisible: module => SLINK.core.storage.get(`ui.modules.${module.id}.showInTorn`, module.defaultShowInTorn)
    });
  } catch (error) {
    console.error('[SLINK] Content startup:', error);
  }
})(globalThis);
