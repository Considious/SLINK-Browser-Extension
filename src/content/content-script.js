(async function startSlinkContent(global) {
  'use strict';

  if (global.__SLINK_EXTENSION_CONTENT_STARTED__) return;
  Object.defineProperty(global, '__SLINK_EXTENSION_CONTENT_STARTED__', { value:true });
  const SLINK = global.SLINK_EXTENSION;
  const startupKeys = [
    'ui.pagePanelHidden','ui.main.position','ui.bubble.position','ui.main.size','ui.main.collapsed','ui.main.minimizedMode',
    'ui.main.navigation.v2','ui.main.activeModule','ui.main.activeModulesByGroup',
    'permissions.snapshot','permissions.leveling','permissions.war','permissions.access',
    SLINK.core.themes.STORAGE_KEY,SLINK.core.themes.PANEL_OPACITY_STORAGE_KEY,SLINK.core.themes.CATALOG_STORAGE_KEY
  ];
  let startupValues = {};
  try {
    const stored = await chrome.storage.local.get(startupKeys.map(key => SLINK.core.storage.fullKey(key)));
    startupValues = Object.fromEntries(startupKeys.filter(key => Object.hasOwn(stored, SLINK.core.storage.fullKey(key)))
      .map(key => [key, stored[SLINK.core.storage.fullKey(key)]]));
  } catch (error) { console.debug('[SLINK] Local startup preferences unavailable:', error); }
  const products = ['permissions.leveling','permissions.war','permissions.access'].map(key => startupValues[key]).filter(Boolean);
  const startupPermissions = SLINK.core.permissions.combineSnapshots(...(products.length ? products : [startupValues['permissions.snapshot']]));
  try {
    const catalog = startupValues[SLINK.core.themes.CATALOG_STORAGE_KEY]?.catalog;
    if (catalog) SLINK.core.themes.installCatalog(catalog);
  } catch (error) { console.debug('[SLINK] Cached theme catalog rejected:', error); }
  const ui = SLINK.core.uiShell.createShell({ title:'SLINK', subtitle:'Shared Live Intelligence NetworK',
    themeId:startupValues[SLINK.core.themes.STORAGE_KEY], permissions:startupPermissions, preferences:startupValues });
  ui.setThemePanelOpacity(startupValues[SLINK.core.themes.PANEL_OPACITY_STORAGE_KEY] ?? SLINK.core.themes.DEFAULT_PANEL_OPACITY);
  let initialized = false;
  let restarting = null;
  let apiLedgerSyncing = false;
  let apiLedgerTimer = null;
  let stakeoutTimer = null;
  let stakeoutTicking = false;
  let runtimeActive = false;
  let modulesRunning = false;
  let activityTransition = Promise.resolve();

  ui.setHidden(Boolean(startupValues['ui.pagePanelHidden']));

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

  function readSharedApiLedger() {
    try {
      const parsed = JSON.parse(global.localStorage.getItem('considious:torn-api-ledger:v1') || 'null');
      return parsed && typeof parsed === 'object' ? parsed : { events:[], cooldownUntil:0 };
    } catch {
      return { events:[], cooldownUntil:0 };
    }
  }

  async function syncSharedApiLedger() {
    if (apiLedgerSyncing || !global.chrome?.runtime?.id) return;
    apiLedgerSyncing = true;
    const synchronize = async (writeBack) => {
      const response = await SLINK.core.messaging.send('tornApi.sync', { ledger:readSharedApiLedger() });
      if (writeBack && response?.ledger) global.localStorage.setItem('considious:torn-api-ledger:v1', JSON.stringify(response.ledger));
    };
    try {
      if (global.navigator?.locks?.request) {
        await global.navigator.locks.request('considious-torn-api-limiter-v1', { mode:'exclusive' }, () => synchronize(true));
      } else {
        // Import TornLib's usage without overwriting its ledger when this
        // browser cannot provide an atomic cross-script lock.
        await synchronize(false);
      }
    } catch (error) {
      if (global.chrome?.runtime?.id) console.debug('[SLINK] Shared Torn API ledger sync paused:', error);
    } finally {
      apiLedgerSyncing = false;
    }
  }

  function stopRuntimeTimers() {
    if (apiLedgerTimer) global.clearInterval(apiLedgerTimer);
    if (stakeoutTimer) global.clearInterval(stakeoutTimer);
    apiLedgerTimer = null;
    stakeoutTimer = null;
  }

  async function runStakeoutTick() {
    if (!runtimeActive || stakeoutTicking || !global.chrome?.runtime?.id) return;
    stakeoutTicking = true;
    try { await SLINK.core.messaging.send('targetList.stakeout.run'); }
    catch (error) { if (global.chrome?.runtime?.id) console.debug('[SLINK] Stakeout heartbeat paused:', error); }
    finally { stakeoutTicking = false; }
  }

  async function startRuntimeTimers() {
    stopRuntimeTimers();
    await syncSharedApiLedger();
    if (!runtimeActive) return;
    apiLedgerTimer = global.setInterval(() => void syncSharedApiLedger(), 10_000);
    await runStakeoutTick();
    if (runtimeActive) stakeoutTimer = global.setInterval(() => void runStakeoutTick(), 5_000);
  }

  async function applyRuntimeActivity(active) {
    const next = Boolean(active);
    activityTransition = activityTransition.then(async () => {
      runtimeActive = next;
      if (!runtimeActive) {
        stopRuntimeTimers();
        // Yield network/DOM workers to the newly active Torn tab without
        // destroying this tab's mounted shell, selected page, or cached data.
        if (modulesRunning) { await SLINK.modules.stopAll({ preserveUi:true }); modulesRunning = false; }
        return;
      }
      if (!initialized || modulesRunning) return;
      const permissions = await reloadThemeAndPermissions();
      if (!runtimeActive) return;
      await startModules(permissions);
      modulesRunning = true;
      await startRuntimeTimers();
    }).catch(error => console.error('[SLINK] Page activity transition:', error));
    return activityTransition;
  }

  async function claimRuntimeActivity() {
    if (document.visibilityState !== 'visible' || document.hasFocus?.() !== true || !global.chrome?.runtime?.id) {
      await applyRuntimeActivity(false);
      return false;
    }
    try {
      const response = await chrome.runtime.sendMessage({ channel:'slink-page-activity', type:'claim', visible:true, url:global.location.href });
      await applyRuntimeActivity(response?.active === true);
      return response?.active === true;
    } catch (error) {
      console.debug('[SLINK] Page activity claim paused:', error);
      await applyRuntimeActivity(false);
      return false;
    }
  }

  function releaseRuntimeActivity() {
    void applyRuntimeActivity(false);
    if (global.chrome?.runtime?.id) void chrome.runtime.sendMessage({ channel:'slink-page-activity', type:'release' }).catch(() => {});
  }

  function permissionAccessKey(value = {}) {
    return JSON.stringify([Number(value.userId) || null,
      [...new Set(value.scopes || [])].sort(), [...new Set(value.roles || [])].sort()]);
  }

  async function reloadThemeAndPermissions() {
    // Theme revalidation may use the network; never put it on module startup's critical path.
    void SLINK.core.messaging.send('themes.catalog').then(record => {
      if (record?.catalog) SLINK.core.themes.installCatalog(record.catalog);
    }).catch(error => console.debug('[SLINK] Theme refresh deferred:', error));
    const [permissions, preferredTheme, panelOpacity] = await Promise.all([
      SLINK.core.messaging.send('permissions.get'),
      SLINK.core.storage.get(SLINK.core.themes.STORAGE_KEY, SLINK.core.themes.DEFAULT_THEME_ID),
      SLINK.core.storage.get(SLINK.core.themes.PANEL_OPACITY_STORAGE_KEY, SLINK.core.themes.DEFAULT_PANEL_OPACITY)
    ]);
    ui.setTheme(preferredTheme, permissions);
    ui.setThemePanelOpacity(panelOpacity);
    return permissions;
  }

  async function restartModules({ restore = false } = {}) {
    if (restarting) return restarting;
    restarting = (async () => {
      stopRuntimeTimers();
      await SLINK.modules.stopAll();
      modulesRunning = false;
      if (restore) await ui.restore();
      if (!runtimeActive) return { restored:restore, inactive:true };
      const permissions = await reloadThemeAndPermissions();
      if (!runtimeActive) return { restored:restore, inactive:true };
      const result = await startModules(permissions);
      modulesRunning = true;
      await startRuntimeTimers();
      if (restore) await ui.restore();
      return { restored:restore, ...result };
    })();
    try { return await restarting; }
    finally { restarting = null; }
  }

  // SLINK must never navigate or refresh Torn. Storage changes are applied in
  // place where that is safe; everything else waits for normal user navigation.
  chrome.storage.onChanged.addListener(changes => {
    const apiLedgerKey = SLINK.core.storage.fullKey('core.tornApiLedger.v1');
    if (changes[apiLedgerKey]) {
      const ledger = changes[apiLedgerKey].newValue || {};
      const cutoff = Date.now() - 60_000;
      const count = Array.isArray(ledger.events) ? ledger.events.filter(event => Number(event?.at) > cutoff).length : 0;
      global.dispatchEvent(new CustomEvent('slink:api-usage', { detail:{ count, limit:60 } }));
    }
    const hiddenKey = SLINK.core.storage.fullKey('ui.pagePanelHidden');
    if (changes[hiddenKey]) ui.setHidden(Boolean(changes[hiddenKey].newValue));
    const collapsedKey = SLINK.core.storage.fullKey('ui.main.collapsed');
    if (changes[collapsedKey]) void ui.setCollapsed(Boolean(changes[collapsedKey].newValue), false);
    const minimizedModeKey = SLINK.core.storage.fullKey('ui.main.minimizedMode');
    if (changes[minimizedModeKey]) void ui.setMinimizedMode(changes[minimizedModeKey].newValue, false);
    const levelingVisibilityKey = SLINK.core.storage.fullKey('ui.modules.leveling.showInTorn');
    const adhdVisibilityKey = SLINK.core.storage.fullKey('ui.modules.adhd.showInTorn');
    const marketVisibilityKey = SLINK.core.storage.fullKey('ui.modules.market.showInTorn');
    const warSettingsKey = SLINK.core.storage.fullKey('war.settings.v1');
    if (initialized && runtimeActive && modulesRunning && (changes[levelingVisibilityKey] || changes[adhdVisibilityKey] || changes[marketVisibilityKey] || changes[warSettingsKey])) {
      void restartModules().catch(error => console.error('[SLINK] Could not apply the Torn GUI mode in place:', error));
    }
    const permissionsKey = SLINK.core.storage.fullKey('permissions.snapshot');
    const themeKey = SLINK.core.storage.fullKey(SLINK.core.themes.STORAGE_KEY);
    const themePanelOpacityKey = SLINK.core.storage.fullKey(SLINK.core.themes.PANEL_OPACITY_STORAGE_KEY);
    const catalogKey = SLINK.core.storage.fullKey(SLINK.core.themes.CATALOG_STORAGE_KEY);
    if (changes[catalogKey]?.newValue?.catalog) {
      try { SLINK.core.themes.installCatalog(changes[catalogKey].newValue.catalog); }
      catch (error) { console.error('[SLINK] Rejected invalid cached theme catalog:', error); }
    }
    if (changes[permissionsKey] && initialized && runtimeActive && modulesRunning
      && permissionAccessKey(changes[permissionsKey].oldValue) !== permissionAccessKey(changes[permissionsKey].newValue)) {
      void restartModules().catch(error => console.error('[SLINK] Could not apply refreshed permissions in place:', error));
      return;
    }
    if (changes[themePanelOpacityKey]) {
      ui.setThemePanelOpacity(changes[themePanelOpacityKey].newValue);
    }
    if (changes[themeKey] || changes[catalogKey]) {
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
    if (message?.channel !== 'slink-page-activity' || message?.type !== 'active-state') return false;
    void applyRuntimeActivity(message.active === true).then(() => sendResponse({ ok:true, active:runtimeActive })).catch(error => sendResponse({ ok:false, error:SLINK.core.format.errorMessage(error) }));
    return true;
  });

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.channel !== 'slink-ui-control' || message?.type !== 'restore') return false;
    void restartModules({ restore:true })
      .then(result => sendResponse({ ok:true, ...result }))
      .catch(error => sendResponse({ ok:false, error:SLINK.core.format.errorMessage(error) }));
    return true;
  });

  try {
    void SLINK.core.messaging.send('content.ready', { url:global.location.href }).catch(error => console.debug('[SLINK] Page registration deferred:', error));
    await ui.ready;
    initialized = true;
    await claimRuntimeActivity();
  } catch (error) {
    console.error('[SLINK] Content startup:', error);
  }

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void claimRuntimeActivity();
    else releaseRuntimeActivity();
  });
  global.addEventListener('focus', () => void claimRuntimeActivity());
  global.addEventListener('blur', releaseRuntimeActivity);
  global.addEventListener('pageshow', () => void claimRuntimeActivity());
  global.addEventListener('pagehide', releaseRuntimeActivity);
})(globalThis);


