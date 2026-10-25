importScripts(
  '../core/runtime.js',
  '../core/format.js',
  '../core/storage.js',
  '../core/player-intelligence.js',
  '../core/target-list.js',
  '../core/bounties.js',
  '../core/abroad-stocks.js',
  '../core/travel-safety.js',
  '../core/company.js',
  '../core/museum.js',
  '../core/money-property.js',
  '../core/events.js',
  '../core/faction-officers.js',
  'local-vault.js',
  '../core/permissions.js',
  '../core/adhd.js',
  '../core/market.js',
  '../core/merits.js',
  '../core/themes.js',
  '../core/messaging.js',
  '../core/http.js',
  '../core/war.js',
  '../core/worker-client.js',
  '../core/torn-api-limiter.js',
  '../core/shared-data.js',
  'shared-data-service.js',
  'player-intelligence-service.js',
  'target-list-service.js',
  'theme-service.js',
  'permission-service.js',
  'chat-config-service.js',
  'faction-officer-service.js',
  'travel-safety-service.js',
  'company-service.js',
  'museum-service.js',
  'money-property-service.js',
  'events-service.js',
  'mugging-service.js',
  'adhd-service.js',
  'market-service.js',
  'merits-service.js',
  'player-stats-service.js',
  'leveling-service.js',
  'bounties-service.js',
  'war-service.js',
  'contribution-service.js',
  'abroad-stocks-service.js',
  'audio-service.js'
);

const SLINK = globalThis.SLINK_EXTENSION;
const CONNECTION_ALARM = 'slink.worker.connection';
const CONNECTION_ALARM_MINUTES = 15;
const WAR_CYCLE_ALARM = 'slink.war.cycle';

function bootstrapPermissions() {
  return {
    userId: null,
    roles: ['foundation'],
    scopes: [],
    source: 'local-bootstrap',
    issuedAt: Date.now(),
    expiresAt: 0
  };
}

async function getPermissionSnapshot() {
  const [leveling, war, access, stored] = await Promise.all([
    SLINK.core.storage.get('permissions.leveling', null),
    SLINK.core.storage.get('permissions.war', null),
    SLINK.core.storage.get('permissions.access', null),
    SLINK.core.storage.get('permissions.snapshot', null)
  ]);
  if (!leveling && !war && !access) return SLINK.core.permissions.normalizeSnapshot(stored || bootstrapPermissions());
  const combined = SLINK.core.permissions.combineSnapshots(leveling, war, access, bootstrapPermissions());
  await SLINK.core.storage.set('permissions.snapshot', combined);
  return combined;
}

async function ensureDefaultState() {
  const [storedCombined, storedLeveling, storedWar, storedAccess, levelingSession, warSession, accessSession] = await Promise.all([
    SLINK.core.storage.get('permissions.snapshot', null),
    SLINK.core.storage.get('permissions.leveling', null),
    SLINK.core.storage.get('permissions.war', null),
    SLINK.core.storage.get('permissions.access', null),
    SLINK.core.storage.get('leveling.session.v1', null),
    SLINK.core.storage.get('war.session.v1', null),
    SLINK.core.storage.get('access.session.v1', null)
  ]);
  const legacy = SLINK.core.permissions.normalizeSnapshot(storedCombined || bootstrapPermissions());
  const leveling = storedLeveling || (
    levelingSession?.token && Number(levelingSession.expiresAt) > Date.now()
      ? {
          userId:levelingSession.userId,
          roles:levelingSession.roles,
          scopes:levelingSession.scopes,
          source:'migrated-leveling-session',
          issuedAt:Date.now(),
          expiresAt:levelingSession.expiresAt
        }
      : legacy.scopes.some(scope => SLINK.core.permissions.scopeMatches(scope, 'slink.level'))
        ? { ...legacy, source:'migrated-leveling-snapshot' }
        : null
  );
  const war = storedWar || (
    warSession?.token && Number(warSession.expiresAt) > Date.now()
      ? {
          userId:warSession.userId,
          roles:warSession.roles,
          scopes:warSession.scopes,
          source:'migrated-war-session',
          issuedAt:Date.now(),
          expiresAt:warSession.expiresAt
        }
      : null
  );
  const access = storedAccess || (
    accessSession?.token && Number(accessSession.expiresAt) > Date.now()
      ? {
          userId:accessSession.userId,
          roles:accessSession.roles,
          scopes:accessSession.scopes,
          source:'migrated-permission-session',
          issuedAt:Date.now(),
          expiresAt:accessSession.expiresAt
        }
      : null
  );
  if (leveling && !storedLeveling) await SLINK.core.storage.set('permissions.leveling', leveling);
  if (war && !storedWar) await SLINK.core.storage.set('permissions.war', war);
  if (access && !storedAccess) await SLINK.core.storage.set('permissions.access', access);
  await SLINK.core.storage.set(
    'permissions.snapshot',
    SLINK.core.permissions.combineSnapshots(leveling, war, access, bootstrapPermissions())
  );
  if (await SLINK.core.storage.get('ui.pagePanelHidden', undefined) === undefined) {
    await SLINK.core.storage.set('ui.pagePanelHidden', false);
  }
}

async function ensureConnectionAlarm() {
  if (!await chrome.alarms.get(CONNECTION_ALARM)) {
    await chrome.alarms.create(CONNECTION_ALARM, {
      delayInMinutes: CONNECTION_ALARM_MINUTES,
      periodInMinutes: CONNECTION_ALARM_MINUTES
    });
  }
  // War collection is demand-driven by one live extension page. Remove the
  // legacy background alarm so a closed/idle UI never keeps polling.
  await chrome.alarms.clear(WAR_CYCLE_ALARM);
  await SLINK.services.adhd.ensureAlarm();
  await SLINK.services.market.ensureAlarm();
  await SLINK.services.market.ensureDollarAlarm();
  await SLINK.services.playerStats.ensureAlarm();
  await SLINK.services.targetList.ensureAlarm();
  await SLINK.services.mugging.ensureAlarm();
  await SLINK.services.abroadStocks.ensureAlarm();
}

async function connectionStatus() {
  const status = await SLINK.core.workerClient.probe();
  await SLINK.core.storage.set('worker.lastStatus', status);
  return status;
}

let initializing = null;
function initialize(reason = 'service-worker') {
  if (initializing) return initializing;
  initializing = (async () => {
    const recovery = await globalThis.SLINK_LOCAL_VAULT.restoreMissing();
    await ensureDefaultState();
    await ensureConnectionAlarm();
    await Promise.allSettled([connectionStatus(), SLINK.services.themes.load(reason === 'install')]);
    const mirror = await globalThis.SLINK_LOCAL_VAULT.snapshot();
    await SLINK.core.storage.set('storage.health.v1', {
      initializedAt:Date.now(),
      reason,
      version:SLINK.VERSION,
      recovered:Number(recovery?.recovered) || 0,
      mirrored:Number(mirror?.saved) || 0,
      vaultAvailable:mirror?.available === true
    });
    return { recovery, mirror };
  })().finally(() => { initializing = null; });
  return initializing;
}

async function restoreTornUi() {
  await Promise.all([
    SLINK.core.storage.remove('ui.main.position'),
    SLINK.core.storage.remove('ui.bubble.position'),
    SLINK.core.storage.remove('ui.main.collapsed'),
    SLINK.core.storage.remove('ui.modules.leveling.docked'),
    SLINK.core.storage.remove('ui.modules.war.docked'),
    SLINK.core.storage.set('ui.pagePanelHidden', false)
  ]);
  const tabs = await chrome.tabs.query({ url:'https://www.torn.com/*' });
  let restored = 0;
  for (const tab of tabs) {
    if (!Number.isInteger(tab?.id)) continue;
    try {
      const response = await chrome.tabs.sendMessage(tab.id, {
        channel:'slink-ui-control',
        type:'restore'
      });
      if (response?.ok) restored += 1;
    } catch {
      // A pre-update tab may not have the current content script. Never reload
      // or navigate Torn automatically; normal user navigation will load it.
    }
  }
  return {
    restored,
    matchingTabs:tabs.length,
    needsManualPageLoad:tabs.length > restored
  };
}

async function capabilityStatus() {
  const entries = await Promise.all(
    Object.entries(SLINK.core.permissions.BROWSER_CAPABILITIES).map(async ([id, capability]) => {
      const granted = await chrome.permissions.contains({ origins: [...capability.origins] });
      return [id, {
        label: capability.label,
        optional: capability.optional,
        origins: [...capability.origins],
        granted
      }];
    })
  );
  return Object.fromEntries(entries);
}

async function recordDiagnostic(source) {
  const [worker, contributionWorker, warWorker, capabilities, tornApiUsage, alarm, pageInjection, leveling, war, adhd] = await Promise.all([
    SLINK.core.workerClient.probe({ deep: true }),
    SLINK.services.contribution.health(),
    SLINK.services.war.health(),
    capabilityStatus(),
    SLINK.core.tornApiLimiter.getUsage(),
    chrome.alarms.get(CONNECTION_ALARM),
    SLINK.core.storage.get('diagnostics.pageInjection', null),
    SLINK.services.leveling.publicStatus(),
    SLINK.services.war.publicStatus(),
    SLINK.services.adhd.publicStatus(false)
  ]);
  await SLINK.core.storage.set('worker.lastStatus', worker);

  const result = {
    at: Date.now(),
    source: String(source || 'manual'),
    overall: worker.connected && Boolean(alarm) && (!war.configured || warWorker.connected) ? 'ready' : 'attention',
    extensionVersion: chrome.runtime.getManifest().version,
    coreVersion: SLINK.VERSION,
    background: { ok: true },
    storage: { ok: true },
    alarm: {
      ok: Boolean(alarm),
      periodMinutes: Number(alarm?.periodInMinutes) || null
    },
    worker,
    contributionWorker,
    pageInjection,
    leveling: {
      configured: leveling.configured,
      authenticated: leveling.session.authenticated,
      targets: leveling.runtime.targets.length,
      pendingChecks: leveling.runtime.pendingChecks,
      collector: leveling.runtime.collector
    },
    war: {
      configured: war.configured,
      authenticated: war.session.authenticated,
      activeWar: war.activeWar,
      factionCapable: war.session.factionCapable,
      status: war.runtime.status,
      worker: warWorker
    },
    adhd:{ configured:adhd.configured, permitted:adhd.permitted, activeAlerts:adhd.activeAlerts.length, lastError:adhd.lastError },
    capabilities,
    tornApiUsage
  };
  await SLINK.core.storage.set('diagnostics.lastRun', result);
  return result;
}

async function requireAdminPermission() {
  const permissions = await getPermissionSnapshot();
  if (!SLINK.core.permissions.hasScope(permissions, 'admin.*')) {
    const error = new Error('admin.* permission is required to view diagnostics.');
    error.code = 'SLINK_ADMIN_REQUIRED';
    throw error;
  }
  return permissions;
}

const routes = {
  async 'system.ping'() {
    return {
      ok: true,
      now: Date.now(),
      extensionVersion: chrome.runtime.getManifest().version,
      coreVersion: SLINK.VERSION
    };
  },

  async 'system.status'() {
    const [permissions, capabilities, lastDiagnostic, tornApiUsage, worker, access, adhd] = await Promise.all([
      getPermissionSnapshot(),
      capabilityStatus(),
      SLINK.core.storage.get('diagnostics.lastRun', null),
      SLINK.core.tornApiLimiter.getUsage(),
      connectionStatus(),
      SLINK.services.permissionAccess.status().catch(error => ({ configured:false, error:SLINK.core.format.errorMessage(error) })),
      SLINK.services.adhd.publicStatus(true)
    ]);
    return {
      permissions,
      capabilities,
      lastDiagnostic,
      tornApiUsage,
      worker,
      access,
      adhd,
      leveling: await SLINK.services.leveling.publicStatus(),
      war: await SLINK.services.war.publicStatus(),
      contribution: await SLINK.services.contribution.status().catch(() => ({ configured:false, donation:null }))
    };
  },

  async 'permissions.get'() {
    return getPermissionSnapshot();
  },

  async 'capabilities.get'() {
    return capabilityStatus();
  },

  async 'content.ready'(payload, sender) {
    const pageUrl = new URL(String(sender?.tab?.url || payload?.url || ''));
    if (pageUrl.hostname !== 'www.torn.com') {
      const error = new Error('SLINK content registration is restricted to Torn.');
      error.code = 'SLINK_CONTENT_ORIGIN_DENIED';
      throw error;
    }
    const injection = {
      at: Date.now(),
      tabId: Number.isInteger(sender?.tab?.id) ? sender.tab.id : null,
      page: `${pageUrl.origin}${pageUrl.pathname}`
    };
    await SLINK.core.storage.set('diagnostics.pageInjection', injection);
    return injection;
  },

  async 'tornApi.sync'(payload, sender) {
    const pageUrl = new URL(String(sender?.tab?.url || ''));
    if (pageUrl.hostname !== 'www.torn.com') {
      const error = new Error('The shared Torn API ledger can only be synchronized from Torn.');
      error.code = 'SLINK_CONTENT_ORIGIN_DENIED';
      throw error;
    }
    return SLINK.core.tornApiLimiter.syncShared(payload);
  },

  async 'tornApi.usage'() {
    return SLINK.core.tornApiLimiter.getUsage();
  },

  async 'ui.torn.restore'() {
    return restoreTornUi();
  },

  async 'ui.dashboard.open'(payload = {}) {
    const page = ['workspace', 'alerts', 'quality', 'admin', 'diagnostics'].includes(String(payload.page))
      ? String(payload.page)
      : await SLINK.core.storage.get('ui.dashboard.activePage','workspace');
    await SLINK.core.storage.set('ui.dashboard.activePage', page);
    if (page === 'alerts') {
      const efficiencyView = ['alerts', 'market', 'merits', 'dollar'].includes(String(payload.efficiencyView))
        ? String(payload.efficiencyView)
        : 'alerts';
      await SLINK.core.storage.set('ui.efficiency.activeView', efficiencyView);
    }
    if(page==='workspace'&&['overview','bounties','mugging','target-list'].includes(payload.combatView))await SLINK.core.storage.set('ui.dashboard.combatView',payload.combatView);
    if(page==='quality'&&['racing','abroad-stocks','company','museums','money-property','events','faction-officers','chat'].includes(payload.qualityView))await SLINK.core.storage.set('ui.quality.activeView',payload.qualityView);
    await chrome.runtime.openOptionsPage();
    return { opened:true, page };
  },

  async 'diagnostics.run'() {
    await requireAdminPermission();
    return recordDiagnostic('manual');
  },

  async 'diagnostics.status'() {
    await requireAdminPermission();
    return {
      lastRun: await SLINK.core.storage.get('diagnostics.lastRun', null),
      alarm: await chrome.alarms.get(CONNECTION_ALARM),
      worker: await connectionStatus()
    };
  },

  ...SLINK.services.leveling.routes,
  ...SLINK.services.playerIntelligence.routes,
  ...SLINK.services.targetList.routes,
  ...SLINK.services.chatConfig.routes,
  ...SLINK.services.bounties.routes,
  ...SLINK.services.war.routes,
  ...SLINK.services.permissionAccess.routes,
  ...SLINK.services.factionOfficer.routes,
  ...SLINK.services.travelSafety.routes,
  ...SLINK.services.company.routes,
  ...SLINK.services.museum.routes,
  ...SLINK.services.moneyProperty.routes,
  ...SLINK.services.events.routes,
  ...SLINK.services.mugging.routes,
  ...SLINK.services.adhd.routes,
  ...SLINK.services.market.routes,
  ...SLINK.services.merits.routes,
  ...SLINK.services.themes.routes,
  ...SLINK.services.playerStats.routes,
  ...SLINK.services.contributionRoutes,
  ...SLINK.services.abroadStocks.routes,
  ...SLINK.services.audio.routes
};

let activeTornPageTabId = null;
let activityRevision = 0;
let activityQueue = Promise.resolve();

async function notifyTornPageActivity(tabId, active) {
  if (!Number.isInteger(tabId)) return;
  try {
    await chrome.tabs.sendMessage(tabId, { channel:'slink-page-activity', type:'active-state', active:Boolean(active), revision:activityRevision });
  } catch {
    // Non-Torn tabs and pages still loading do not have the content listener.
  }
}

async function eligibleTornPageTab() {
  const windows = await chrome.windows.getAll({ populate:false });
  const focused = windows.find(window => window.focused && window.state !== 'minimized');
  if (!focused) return null;
  const [tab] = await chrome.tabs.query({ active:true, windowId:focused.id });
  try {
    const url = new URL(tab?.url);
    return url.protocol === 'https:' && url.hostname === 'www.torn.com' ? tab.id : null;
  } catch { return null; }
}

function reconcileTornPageActivity(excludedTabId = null) {
  const revision = ++activityRevision;
  const task = activityQueue.then(async () => {
    let next = await eligibleTornPageTab();
    if (revision !== activityRevision) return false;
    if (next === excludedTabId) next = null;
    const previous = activeTornPageTabId;
    activeTornPageTabId = null;
    if (Number.isInteger(previous) && previous !== next) await notifyTornPageActivity(previous, false);
    // A switch received while revocation was awaited must never grant the old candidate.
    if (revision !== activityRevision) return false;
    if (next !== await eligibleTornPageTab() || revision !== activityRevision) return false;
    activeTornPageTabId = next;
    if (Number.isInteger(next)) await notifyTornPageActivity(next, true);
    return revision === activityRevision && activeTornPageTabId === next;
  });
  activityQueue = task.catch(() => undefined);
  return task;
}

async function claimTornPageActivity(tabId) {
  if (!Number.isInteger(tabId)) return false;
  await reconcileTornPageActivity();
  return activeTornPageTabId === tabId && tabId === await eligibleTornPageTab();
}

async function releaseTornPageActivity(tabId) {
  if (!Number.isInteger(tabId)) return false;
  if (activeTornPageTabId !== tabId) return false;
  await reconcileTornPageActivity(tabId);
  return true;
}

function refreshTornPageActivity() {
  void reconcileTornPageActivity().catch(error => console.debug('[SLINK] Activity reconciliation:', error));
}
chrome.tabs.onActivated.addListener(refreshTornPageActivity);
chrome.tabs.onRemoved.addListener(refreshTornPageActivity);
chrome.tabs.onUpdated.addListener((_id, changes) => { if (changes.url || changes.status === 'complete') refreshTornPageActivity(); });
chrome.windows.onFocusChanged.addListener(refreshTornPageActivity);
// Worker globals are not durable. Recover ownership from Chrome, not a saved tab ID.
refreshTornPageActivity();

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.channel !== 'slink-page-activity') return false;
  const tabId = Number.isInteger(sender?.tab?.id) ? sender.tab.id : null;
  if (message.type === 'claim' && message.visible === true) {
    void claimTornPageActivity(tabId).then(active => sendResponse({ active })).catch(error => sendResponse({ active:false, error:SLINK.core.format.errorMessage(error) }));
    return true;
  }
  if (message.type === 'release') {
    void releaseTornPageActivity(tabId).then(() => sendResponse({ active:false })).catch(error => sendResponse({ active:false, error:SLINK.core.format.errorMessage(error) }));
    return true;
  }
  sendResponse({ active:activeTornPageTabId === tabId });
  return false;
});

chrome.runtime.onMessage.addListener(SLINK.core.messaging.createRouter(routes));

chrome.runtime.onInstalled.addListener(details => {
  void initialize(String(details?.reason || 'install')).catch(error => console.error('[SLINK] Install initialization:', error));
});

chrome.runtime.onStartup.addListener(() => {
  void initialize('startup').catch(error => console.error('[SLINK] Startup initialization:', error));
});

chrome.alarms.onAlarm.addListener(alarm => {
  if (alarm.name === CONNECTION_ALARM) void connectionStatus();
  if (alarm.name === SLINK.services.adhd.ALARM) {
    void Promise.all([
      SLINK.services.adhd.publicStatus(true),
      SLINK.services.moneyProperty.publicStatus(true)
    ])
      .then(() => SLINK.services.audio.flush())
      .catch(error => console.error('[SLINK] Efficiency alerts:', error));
    void SLINK.services.merits.publicStatus(true).catch(error => console.error('[SLINK] Merits:', error));
  }
  if (alarm.name === SLINK.services.market.ALARM) {
    void SLINK.services.market.publicStatus(true)
      .then(() => SLINK.services.audio.flush())
      .catch(error => console.error('[SLINK] Market Watch:', error));
  }
  if (alarm.name === SLINK.services.market.DOLLAR_ALARM) {
    void SLINK.services.market.dollarStatus(true).catch(error => console.error('[SLINK] $1 Bazaars:', error));
  }
  if (alarm.name === SLINK.services.playerStats.ALARM) {
    void SLINK.services.playerStats.status().then(status => {
      if (status.configured) return SLINK.services.playerStats.refresh(true);
      return null;
    }).catch(error => console.error('[SLINK] Daily player stats:', error));
  }
  if (alarm.name === SLINK.services.mugging.ALARM) {
    void SLINK.services.mugging.runContribution().catch(error => console.error('[SLINK] Mugging contribution:', error));
  }
  if (alarm.name === SLINK.services.abroadStocks.ALARM) {
    void SLINK.services.abroadStocks.refresh(false)
      .then(() => SLINK.services.audio.flush())
      .catch(error => console.error('[SLINK] Abroad Stocks:', error));
  }
  if (alarm.name === SLINK.services.targetList.POLL_ALARM) {
    void Promise.allSettled([
      SLINK.services.targetList.runPolling(),
      SLINK.services.targetList.runStakeouts()
    ]).then(results => {
      const rejected = results.find(result => result.status === 'rejected');
      if (rejected) console.error('[SLINK] Target List scheduling:', rejected.reason);
    });
  }
});

void initialize().catch(error => console.error('[SLINK] Service worker initialization:', error));

