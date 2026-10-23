import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(testDirectory, '..');

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function assertFile(relativePath) {
  assert(fs.existsSync(path.join(root, relativePath)), `Missing extension file: ${relativePath}`);
}

function listFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const fullPath = path.join(directory, entry.name);
    return entry.isDirectory() ? listFiles(fullPath) : [fullPath];
  });
}

const manifest = JSON.parse(read('manifest.json'));
const packageJson = JSON.parse(read('package.json'));

assert(manifest.manifest_version === 3, 'The extension must use Manifest V3.');
assert(manifest.version === packageJson.version, 'Manifest and package versions must match.');
assert(!JSON.stringify(manifest).includes('<all_urls>'), 'The extension must not request <all_urls>.');
assert(manifest.permissions.includes('storage'), 'Storage permission is required.');
assert(manifest.permissions.includes('alarms'), 'Alarms permission is required.');
assert(manifest.permissions.includes('offscreen'), 'Background alert audio requires Chrome offscreen-document access.');
const requiredHosts = [
  'https://www.torn.com/*',
  'https://api.torn.com/*',
  'https://ffscouter.com/*',
  'https://weav3r.dev/*',
  'https://slinkyleveling.richard-johnson554.workers.dev/*',
  'https://slinkcontributionworker.richard-johnson554.workers.dev/*',
  'https://slinkwarworker.richard-johnson554.workers.dev/*'
];
assert(
  requiredHosts.every(host => manifest.host_permissions.includes(host)),
  'Required host access must include Torn, Torn API, FFScouter, Weaver, and all SLINK Workers.'
);
assert(
  !Object.prototype.hasOwnProperty.call(manifest, 'optional_host_permissions'),
  'Core SLINK services must not be presented as optional access.'
);

assertFile(manifest.background.service_worker);
assertFile(manifest.action.default_popup);
assertFile(manifest.options_ui.page);
assertFile('src/offscreen/audio.html');
assertFile('src/offscreen/audio.js');
for (const entry of manifest.content_scripts) {
  for (const script of entry.js || []) assertFile(script);
  for (const stylesheet of entry.css || []) assertFile(stylesheet);
}

const backgroundPath = path.join(root, manifest.background.service_worker);
const backgroundSource = fs.readFileSync(backgroundPath, 'utf8');
for (const match of backgroundSource.matchAll(/['"]([^'"]+\.js)['"]/g)) {
  if (!match[1].startsWith('.')) continue;
  const importedPath = path.resolve(path.dirname(backgroundPath), match[1]);
  assert(fs.existsSync(importedPath), `Missing service-worker import: ${match[1]}`);
}

for (const page of [manifest.action.default_popup, manifest.options_ui.page]) {
  const html = read(page);
  for (const match of html.matchAll(/(?:src|href)="([^"]+)"/g)) {
    const reference = match[1];
    if (/^(?:https?:|#)/.test(reference)) continue;
    const resolved = path.resolve(path.dirname(path.join(root, page)), reference);
    assert(fs.existsSync(resolved), `Missing extension-page resource: ${reference}`);
  }
}

for (const file of listFiles(path.join(root, 'src')).filter(file => file.endsWith('.js'))) {
  const source = fs.readFileSync(file, 'utf8');
  new vm.Script(source, { filename: path.relative(root, file) });
  assert(!/\beval\s*\(|\bnew\s+Function\s*\(/.test(source), `Remote-code execution primitive in ${path.relative(root, file)}.`);
  assert(!source.includes('chrome.permissions.request'), 'Core SLINK hosts must not require runtime permission buttons.');
  const forbiddenPageNavigation = [
    /\blocation\s*\.\s*reload\s*\(/,
    /\b(?:chrome|browser)\s*\.\s*tabs\s*\.\s*reload\s*\(/,
    /\bhistory\s*\.\s*go\s*\(\s*0\s*\)/,
    /\blocation\s*\.\s*(?:assign|replace)\s*\(/
  ];
  for (const pattern of forbiddenPageNavigation) {
    assert(
      !pattern.test(source),
      `Forbidden page refresh/navigation capability in ${path.relative(root, file)}.`
    );
  }
}

assert(!read(manifest.action.default_popup).includes('Optional access'), 'Popup must not present core services as optional.');

const runtimeSource = read('src/core/runtime.js');
assert(runtimeSource.includes(`const VERSION = '${manifest.version}'`), 'Core runtime version must match the manifest.');

const uiShellSource = read('src/content/ui-shell.js');
assert(uiShellSource.includes('ACTIVE_NAVIGATION_MIRROR_KEY'), 'Torn-page navigation must have an immediate reload-safe mirror.');
assert(uiShellSource.includes('await navigationPreferencesReady'), 'Saved navigation must load before module tabs are created.');
assert(uiShellSource.includes('writeNavigationMirror(snapshot);'), 'Navigation changes must be mirrored before asynchronous extension storage completes.');
assert(uiShellSource.includes('NAVIGATION_FALLBACK_ORDER'), 'Torn-page navigation must use a deterministic fallback independent of module registration order.');
assert(uiShellSource.includes('views.get(preferredActiveId)'), 'The exact saved Torn-page module must win when it becomes available.');
assert(uiShellSource.includes('NAVIGATION_STATE_STORAGE_KEY') && uiShellSource.includes("'ui.main.navigation.v2'"), 'Torn-page navigation must persist one atomic versioned state record.');
assert(uiShellSource.includes('preferredActiveGroup = activeGroup') && uiShellSource.includes('activeModulesByGroup:Object.fromEntries(preferredActiveIdsByGroup)'), 'Torn-page navigation must save the exact top-level section and sub-tab together.');
assert(uiShellSource.includes('navigationWriteQueue = navigationWriteQueue.then'), 'Rapid tab changes must be serialized so an older asynchronous write cannot replace the newest selection.');
assert(uiShellSource.includes('Math.max(Date.now(), navigationUpdatedAt + 1)'), 'Navigation revisions must remain strictly ordered.');
assert(uiShellSource.includes('!navigationSelectionChanged && !hasRestoredNavigationSelection && firstRunFallback'), 'Module registration order must not make the newest feature the default page.');
assert(!uiShellSource.includes('docked.find(view => preferredActiveIdsByGroup.get(view.group) === view.id)'), 'Navigation restore must not select an arbitrary saved group instead of the exact last section.');

assert(uiShellSource.includes('.window.main > .theme-content-shell > .head, .window.main > .theme-content-shell > .groups, .window.main > .theme-content-shell > .tabs { flex:0 0 auto; }'), 'Resizable Torn navigation must keep its full height instead of collapsing into the module body.');
assert(uiShellSource.includes('.window.main > .theme-content-shell > .module-view { display:flex; flex:1 1 auto; flex-direction:column; min-height:0; overflow:hidden; }'), 'The active Torn module must be a bounded flex region inside the resizable panel.');
assert(uiShellSource.includes('.window.main > .theme-content-shell > .module-view > .content { flex:1 1 auto; min-height:0; max-height:none; overflow-y:auto; overflow-x:hidden; overscroll-behavior:contain; }'), 'The Torn module body must retain its own vertical scrolling.');
assert(uiShellSource.includes("MAIN_SIZE_STORAGE_KEY = 'ui.main.size'") && uiShellSource.includes('MAIN_SIZE_MIRROR_KEY'), 'The resizable Torn panel must keep an exact persistent size record.');
assert(uiShellSource.includes('function rememberMainSize') && uiShellSource.includes('persistSize()'), 'The Torn panel must restore and save user resizing.');
assert(uiShellSource.includes("element.addEventListener('pointerdown'") && uiShellSource.includes("global.addEventListener('pointerup', finishResize)"), 'Panel size must only be saved after an intentional resize interaction.');
assert(uiShellSource.includes('if (preferredSize) applySize(preferredSize)') && uiShellSource.includes('mover.clamp(true)'), 'Saved panel size and position must be clamped to the current viewport.');



const dashboardHtml = read('src/dashboard/dashboard.html');
const dashboardSource = read('src/dashboard/dashboard.js');
const dashboardIds = new Set([...dashboardHtml.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]));
assert(dashboardSource.includes("storage.set('ui.dashboard.activePage'"), 'Dashboard page changes must persist the exact active page.');
assert(!dashboardSource.includes("storage.remove('ui.dashboard.activePage')"), 'Dashboard startup must never erase the saved active page.');
assert(dashboardSource.includes("switchPage('workspace', false)"), 'Temporary permission fallback must not overwrite the saved dashboard page.');
for (const match of dashboardSource.matchAll(/byId\('([^']+)'\)/g)) {
  assert(dashboardIds.has(match[1]), `Dashboard script references missing element #${match[1]}.`);
}
assert(/function setBusy\(button, busy\)\s*{\s*if \(button\)/.test(dashboardSource), 'Dashboard busy-state helper must tolerate removed or unavailable controls.');
assert(dashboardHtml.includes('id="theme-options"'), 'Dashboard theme selector is missing.');
assert(dashboardHtml.includes('id="player-stats-refresh"') && dashboardHtml.includes('id="ps-armory-balance"'), 'The compact player-stat panel is missing.');
assert(dashboardHtml.includes('id="backup-local-data"') && dashboardHtml.includes('id="restore-local-file"'), 'The local cross-build backup and restore controls are missing.');
assert(dashboardSource.includes('exportNamespace') && dashboardSource.includes('importNamespace'), 'The dashboard does not connect the local backup and restore controls.');
assert(dashboardHtml.includes('data-dashboard-page="alerts"') && dashboardHtml.includes('id="use-adhd"') && dashboardHtml.includes('id="adhd-city-done"'), 'The separate ADHD Alerts dashboard page or its global city completion control is missing.');
assert(dashboardHtml.includes('>Efficiency<') && dashboardHtml.includes('id="adhd-sound-choice"') && dashboardHtml.includes('id="adhd-custom-sound"'), 'Efficiency naming or notification-sound controls are missing.');
assert(dashboardSource.includes("messaging.send('audio.play', { soundChoice:byId('adhd-sound-choice').value"), 'The alert-sound preview does not test the real background audio path.');
assert(dashboardHtml.includes('data-efficiency-view="merits"') && dashboardHtml.includes('id="merits-refresh-minutes"') && dashboardHtml.includes('id="merits-pinned-list"'), 'Efficiency is missing its Merits tab, refresh control, or three-goal farm list.');
assert(manifest.content_scripts.some(entry => entry.js?.includes('src/modules/merits.js')), 'Merits is missing from the in-Torn Efficiency tools.');
assert(dashboardHtml.includes('data-efficiency-view="dollar"') && dashboardHtml.includes('id="dollar-bazaars-refresh"') && dashboardHtml.includes('id="dollar-bazaars-list"'), 'Efficiency is missing its $1 Bazaars tab, manual refresh, or results list.');
assert(manifest.content_scripts.some(entry => entry.js?.includes('src/modules/dollar-bazaars.js')), '$1 Bazaars is missing from the in-Torn Efficiency tools.');
assert(dashboardHtml.includes('data-efficiency-view="market"') && dashboardHtml.includes('id="market-watch-form"') && dashboardHtml.includes('id="market-quick-buy"'), 'Efficiency is missing its Market Watch tab, editor, or quick-buy control.');
assert(dashboardHtml.includes('id="market-watch-type"') && dashboardHtml.includes('>Points Market<') && dashboardHtml.includes('id="market-watch-item-id"') && dashboardHtml.includes('id="market-item-suggestions"'), 'Market Watch is missing Points Market or its ID-backed searchable item selector.');
assert(dashboardHtml.includes('id="market-weaver-pricelist"') && dashboardHtml.includes('id="market-weaver-source-order"') && dashboardHtml.includes('market-weaver-pricelist-sync'), 'Market Watch is missing Weaver price-list source controls or manual sync.');
assert(dashboardHtml.includes('id="market-watch-enabled"') && dashboardHtml.includes('id="market-weaver-item-list"') && dashboardHtml.includes('id="market-weaver-clear-active"'), 'Market Watch is missing saved-watch activation or per-item Weaver selection controls.');
assert(dashboardSource.includes('settings.lastPriority') && dashboardSource.includes('selectMarketItem'), 'Market Watch does not preserve the selected priority or bind catalog choices to Torn IDs.');
assert(read('src/dashboard/dashboard.css').includes('.market-watch-list{display:grid;grid-template-columns:repeat(3'), 'Market watches are not presented in a three-column desktop grid.');
assert(manifest.content_scripts.some(entry => entry.js?.includes('src/core/market.js') && entry.js?.includes('src/modules/market.js')), 'Market Watch is missing from the in-Torn Efficiency tools.');
const marketServiceSource = read('src/background/market-service.js');
const marketModuleSource = read('src/modules/market.js');
const audioServiceSource = read('src/background/audio-service.js');
const offscreenAudioSource = read('src/offscreen/audio.js');
assert(marketServiceSource.includes('/v2/market/') && marketServiceSource.includes("requestJson('weaver'") && marketServiceSource.includes('/v2/torn/items'), 'Market/Bazaar Watch is not sourced from the declared JSON APIs.');
assert(marketServiceSource.includes("weaverJson('https://weav3r.dev/api/marketplace'") && marketServiceSource.includes('/api/pricelist/') && marketServiceSource.includes('pollWeaverTargets'), 'Weaver watches do not use summary-first screening for the SLINK and Weaver price lists.');
assert(marketServiceSource.includes("weaverJson('https://weav3r.dev/api/dollar-bazaars/bazaars?page=1&limit=100'") && marketServiceSource.includes("'market.dollar.refresh'") && marketServiceSource.includes('periodInMinutes:60'), '$1 Bazaars does not use Weaver’s per-bazaar JSON totals, hourly cache, and manual refresh route.');
assert(!read('src/modules/dollar-bazaars.js').includes('fetch(') && !read('src/modules/dollar-bazaars.js').includes('querySelectorAll'), '$1 Bazaars must use the background API route instead of scraping a web page.');
assert(!marketServiceSource.includes('workerClient') && !marketServiceSource.includes('D1'), 'Private Market/Bazaar Watch data must remain local instead of using a SLINK Worker or D1.');
assert(marketServiceSource.includes('summarizeErrors') && marketServiceSource.includes('tornBlockedUntil'), 'Market Watch does not collapse repeated capacity errors or stop redundant limiter retries within one cycle.');
assert(marketModuleSource.includes('SLINK Buy') && marketModuleSource.includes('data-slink-market-highlight'), 'Torn listing highlights or the custom buy control are missing.');
assert(marketModuleSource.includes('quickPurchaseAnchor') && marketModuleSource.includes('anchor:flow.anchor') && marketModuleSource.includes('QUICK_PURCHASE_FLOW_TIMEOUT_MS'), 'SLINK Buy does not preserve the working Dashboard anchor through its multi-stage purchase flow.');
assert(marketModuleSource.includes('bazaarQuantityInput') && marketModuleSource.includes('button[data-testid="activate-buy-button"]') && marketModuleSource.includes('button[data-testid="buy-button"]'), 'The working Dashboard Bazaar open/fill/buy controls were not ported.');
assert(marketModuleSource.includes("nodeUnavailable(node, kind = '')") && marketModuleSource.includes("kind === 'item-market'") && marketModuleSource.includes('input.disabled || input.readOnly'), 'Item Market availability does not preserve disabled-before-quantity Torn rows.');
assert(marketModuleSource.includes('data-slink-market-shop-profit') && marketModuleSource.includes('listingHighlightState'), 'City-shop-profit highlighting is missing from Torn purchase pages.');
assert(marketModuleSource.includes('data-market-send') && marketModuleSource.includes('Send to Faction'), 'Per-listing Faction Chat sending is missing from the Torn Market GUI.');
assert(marketServiceSource.includes("'market.deal.dismiss'") && marketModuleSource.includes('data-market-dismiss') && dashboardSource.includes("market.deal.dismiss"), 'Five-minute Market Watch dismissal is missing from an interface.');
assert(marketServiceSource.includes("'market.sound.claim'") && marketModuleSource.includes("messaging.send('audio.flush')") && dashboardHtml.includes('market-alert-sound'), 'Market Watch background sound delivery or its user toggle is missing.');
assert(marketServiceSource.includes("'market.weaver.selection.save'") && marketServiceSource.includes('assertActiveSlotLimit') && !marketServiceSource.includes('watches.slice(0, access.limit'), 'The shared active-slot limit is not enforced across saved SLINK and selected Weaver watches.');
assert(read('src/core/market.js').includes('activeSlotKeys') && read('src/core/market.js').includes('weaverActiveItemIds'), 'Market Watch does not deduplicate active SLINK and Weaver item slots.');
assert(audioServiceSource.includes("reasons:['AUDIO_PLAYBACK']") && audioServiceSource.includes('chrome.runtime.getContexts') && audioServiceSource.includes("'adhd.sound.ack'") && audioServiceSource.includes("'market.sound.ack'") && offscreenAudioSource.includes('new Audio()') && offscreenAudioSource.includes('audio.play()') && offscreenAudioSource.includes("type:'audio/wav'"), 'Alert audio is not started and acknowledged through Chrome’s background offscreen-audio document.');
assert(read('src/background/service-worker.js').includes(".then(() => SLINK.services.audio.flush())") && read('src/modules/adhd.js').includes("messaging.send('audio.flush')"), 'Background alarms or Torn Efficiency alerts are not connected to focus-independent sound delivery.');
assert(marketServiceSource.includes("'market.permissions.refresh'") && marketModuleSource.includes('Refresh permissions') && dashboardHtml.includes('market-permissions-refresh'), 'Market Watch is missing its explicit signed-permission refresh control.');
assert(marketModuleSource.includes('Send list to Faction') && marketModuleSource.includes('focusedTornPage'), 'Torn-only Market Watch faction sharing is missing.');
assert(!dashboardSource.includes('Send list to Faction'), 'The extension dashboard must not offer direct Market Watch Faction Chat sending.');
assert(read('src/core/market.js').includes('value?.shops') && read('src/core/market.js').includes('shop sell'), 'Current Torn shop sell-price support is missing from Market Watch.');
assert(read('src/core/merits.js').includes('TRACK_LIMIT = 3') && read('src/background/merits-service.js').includes("'merits.pin'"), 'Merit pinning is missing or no longer limited to three active farms.');
assert(!read('src/background/merits-service.js').includes('workerClient') && !read('src/background/merits-service.js').includes('D1'), 'Private Merit progress must remain local instead of using a SLINK Worker or D1.');
assert(read('src/content/content-script.js').includes('considious:torn-api-ledger:v1') && read('src/content/content-script.js').includes('considious-torn-api-limiter-v1'), 'The extension is not coordinating Torn API usage with TornLib.');
assert(read('src/content/content-script.js').includes("CustomEvent('slink:api-usage'") && read('src/background/service-worker.js').includes("'tornApi.usage'"), 'Alerts and Market Watch are missing their shared live API-usage feed.');
assert(dashboardSource.includes('Snooze 5m') && dashboardSource.includes('Snooze 1h') && dashboardSource.includes('dataset.alertSoundId'), 'Per-alert sound controls or both snooze options are missing.');
assert(!dashboardSource.includes("adhd.alert.dismiss") && !read('src/modules/adhd.js').includes("adhd.alert.dismiss"), 'Normal Efficiency alerts include a redundant dismissal in addition to five-minute snooze.');
assert(read('src/core/adhd.js').includes('bought >= 100') && !read('src/core/adhd.js').includes('cityItemDone'), 'City-item reminders must use one shared 100-item daily cap, not per-item completion flags.');
assert(read('src/background/adhd-service.js').includes("'adhd.city.acknowledge'") && read('src/background/adhd-service.js').includes('cityItemsAtReset'), 'The local ADHD service is missing its global city cap or reset baseline.');
assert(read('src/core/adhd.js').includes('package=com.android.vending') && read('src/core/adhd.js').includes('Google Play Games') && read('src/core/adhd.js').includes('does not support claiming') && read('src/core/adhd.js').includes("id:'googlePlayPoints'") && read('src/background/adhd-service.js').includes("'adhd.google-play-points.acknowledge'"), 'The platform-aware seven-day Google Play Points reminder or claim action is missing.');
const permissionService = read('src/background/permission-service.js');
assert(permissionService.includes('/api/permissions/auth'), 'ADHD access is not backed by the existing signed permissions service.');
assert(permissionService.includes("requestJson('contributionWorker'"), 'Generic permissions are not routed through the Contribution Worker.');
assert(!permissionService.includes("requestJson('warWorker'"), 'Generic permissions still depend on the War Worker.');
assert(permissionService.includes("'access.admin.permissions.grant'") && permissionService.includes("'access.admin.permissions.revoke'"), 'Admin permission assignment is missing explicit additive grant or scoped revoke routes.');
assert(dashboardHtml.includes('id="admin-permanent"') && dashboardHtml.includes('Add checked permissions'), 'The permission manager is missing permanent or additive grants.');
assert(dashboardSource.includes('dataset.revokeScope') && dashboardSource.includes('Unselected permissions were unchanged'), 'The permission manager is missing per-permission revocation or additive-state messaging.');
assert(!read('src/background/adhd-service.js').includes('workerClient') && !read('src/background/adhd-service.js').includes('D1'), 'Private ADHD timer and city data must remain local instead of using Worker or D1 storage.');
assert(read('src/background/player-stats-service.js').includes("'playerStats.refresh'") && read('src/background/player-stats-service.js').includes('personalstats,money,workstats'), 'The local daily Torn player-stat collector is missing or not combined.');
assert(!read('src/background/player-stats-service.js').includes('workerClient') && !read('src/background/player-stats-service.js').includes('D1'), 'Player stats must not use a SLINK Worker or D1.');
assert(read('src/modules/adhd.js').includes('Send to Faction') && read('src/modules/adhd.js').includes('focusedTornPage'), 'Torn-only city-stock copy/send controls are missing.');
assert(!dashboardSource.includes('Send to Faction'), 'The extension dashboard must not offer direct Faction Chat sending.');
assert(read('src/background/adhd-service.js').includes('/v2/torn/stocks') && read('src/core/adhd.js').includes('bonus?.passive !== false'), 'Stock alerts do not use Torn catalog names or still include passive benefits.');
assert(read('src/background/theme-service.js').includes('/api/themes'), 'Background theme catalog route is missing.');
assert(!manifest.host_permissions.some(origin => /githubusercontent|github\.com/.test(origin)), 'The extension must receive theme data through its existing Worker, not direct GitHub host access.');
assert(manifest.web_accessible_resources?.some(entry => entry.resources?.includes('assets/themes/halloween-2026-background.png') && entry.resources?.includes('assets/themes/halloween-2026-icons.png') && entry.resources?.includes('assets/themes/halloween-2026-brand.png') && entry.resources?.includes('assets/themes/halloween-2026-chat.png')), 'Halloween 2026 visual assets are not exposed to the Torn content UI.');
assert(read('src/core/themes.js').includes('ASSET_ORIGIN') && read('src/core/themes.js').includes('assetVariables') && read('src/core/themes.js').includes('brandIcon') && read('src/core/themes.js').includes('chatIcon'), 'The theme core is missing validated image-asset support.');
assert(read('src/dashboard/dashboard.css').includes('data-slink-image-theme="true"') && read('src/dashboard/dashboard.css').includes('data-slink-icon-theme="true"') && read('src/dashboard/dashboard.css').includes('--slink-theme-background-image'), 'The dashboard is missing the generic live image-theme layer.');
const uiStateSource = read('src/core/ui-state.js');
assert(manifest.content_scripts.some(entry => entry.js?.includes('src/core/ui-state.js')), 'Reusable GUI interaction-state preservation is not loaded in Torn.');
assert(uiStateSource.includes('selectionStart') && uiStateSource.includes("querySelectorAll('details')") && uiStateSource.includes('data-slink-preserve-scroll'), 'GUI state preservation is missing focus/cursor, open-section, or scroll restoration.');
assert(uiShellSource.includes('setTheme'), 'Torn UI shell does not support live themes.');
assert(uiShellSource.includes('.status[data-tone="error"] { max-height:72px; overflow:auto;'), 'Torn GUI errors are not constrained to a small scrollable status box.');
assert(uiShellSource.includes('ui.main.collapsed') && uiShellSource.includes('bubble-coil'), 'Torn UI shell does not provide the persistent theme-aware collapse bubble.');
assert(uiShellSource.includes('setBubbleAlert') && uiShellSource.includes('data-alert-kind="retal"') && uiShellSource.includes('data-alert-kind="armory"') && uiShellSource.includes('data-alert-kind="adhd"'), 'The collapse bubble is missing retal, officer armory, or ADHD alert states.');
assert(uiShellSource.includes('ui.main.activeModule') && uiShellSource.includes('ui.main.activeModulesByGroup') && uiShellSource.includes('preferredActiveIdsByGroup.get(groupId)'), 'The Torn shell does not remember the selected module independently for Combat and Efficiency.');
assert(uiShellSource.includes("groups.className = 'groups'") && uiShellSource.includes('setActiveGroup'), 'The Torn shell is missing its Combat/Efficiency navigation level.');
assert(uiShellSource.includes('navigationAlerts') && uiShellSource.includes('setAlertCount') && uiShellSource.includes("alert.group === groupId"), 'The Torn shell is missing module alert badges or parent-group count rollups.');
assert(uiShellSource.includes('background:#d71920') && uiShellSource.includes('border:2px solid #050505') && uiShellSource.includes('color:#fff'), 'Torn navigation alert badges are not theme-independent red, white, and black.');
assert(read('src/modules/adhd.js').includes("setAlertCount('adhd', alerts.length") && read('src/modules/market.js').includes("setAlertCount('market', deals.length") && read('src/modules/war.js').includes("retals.length + itemRequests.length") && read('src/modules/war.js').includes("tab === 'armory' && armoryRequestCount"), 'Efficiency, Market Watch, retaliation, or Armory-request counts are not connected to Torn navigation badges.');
assert(dashboardHtml.includes('data-alert-count="combat"') && dashboardHtml.includes('data-alert-count="efficiency"') && dashboardHtml.includes('data-alert-count="alerts"') && dashboardHtml.includes('data-alert-count="market"'), 'The dedicated dashboard is missing Combat or Efficiency alert badges.');
assert(dashboardSource.includes('efficiencyAlerts + marketDeals') && dashboardSource.includes('retals + armoryRequests'), 'The dedicated dashboard is missing Efficiency rollups or Combat War-alert counts.');
assert(manifest.content_scripts.some(entry => entry.js?.includes('src/modules/player-stats.js')), 'Player Stats is missing from the in-Torn Combat tools.');
assert(read('src/modules/player-stats.js').includes('grid-template-columns:minmax(0,1fr)'), 'The in-Torn Player Stats module can still force a two-column overflow layout.');
assert(uiShellSource.includes('async function restore()'), 'Torn UI shell does not provide an in-place recovery path.');
assert(uiShellSource.includes('.tab[hidden] { display:none !important; }'), 'Inactive Combat or Efficiency module tabs can override their hidden state.');
assert(!uiShellSource.includes('Pop out') && !uiShellSource.includes('setPopped'), 'The broken Torn module pop-out control is still packaged.');
assert(read('src/background/service-worker.js').includes("'ui.torn.restore'"), 'The extension cannot repush its GUI to open Torn tabs.');
assert(read('src/background/service-worker.js').includes("'ui.dashboard.open'") && read('src/modules/adhd.js').includes("SLINK.core.messaging.send('ui.dashboard.open'"), 'The Torn Efficiency settings button is not routed through the background worker.');
assert(dashboardHtml.includes('id="adhd-open-new-tab"') && read('src/modules/adhd.js').includes("openLinksInNewTab === true ? '_blank' : '_self'"), 'Torn Efficiency alert link behavior is not configurable.');
const warModuleSource = read('src/modules/war.js');
const warServiceSource = read('src/background/war-service.js');
const serviceWorkerSource = read('src/background/service-worker.js');
const localVaultSource = read('src/background/local-vault.js');
assert(serviceWorkerSource.includes("'local-vault.js'") && serviceWorkerSource.indexOf('restoreMissing()') < serviceWorkerSource.indexOf('ensureDefaultState();'), 'Durable settings are not restored before extension defaults initialize.');
assert(localVaultSource.includes('indexedDB.open') && localVaultSource.includes('suspiciousBulkRemoval'), 'The same-ID local recovery vault or bulk-removal guard is missing.');
assert(!listFiles(path.join(root, 'src')).some(file => fs.readFileSync(file, 'utf8').includes('chrome.storage.local.clear(')), 'Extension code must never clear all local SLINK storage.');
assert(warModuleSource.includes("activeTab === 'armory'") && warModuleSource.includes('pageIsFocused()'), 'The in-Torn War module is missing its focused-page Armory Recaller.');
assert(warModuleSource.includes('Search name, rank, or ID') && warModuleSource.includes('Select shown') && warModuleSource.includes('Clear shown'), 'The Armory whitelist is missing standalone-compatible search or bulk rank selection.');
assert(warModuleSource.includes('captureDisplayedRankOrder') && warModuleSource.includes("war.armory.rankOrder.v1") && warModuleSource.includes('12 * 60 * 60_000'), 'The Armory whitelist is missing Torn rank ordering or its 12-hour roster cache.');
assert(warModuleSource.includes("const content = activeTab === 'armory'") && warModuleSource.includes("? `${tabBar}<div>${body}</div>`"), 'The Armory tab still includes unrelated War summary and alert content.');
assert(warModuleSource.includes('belongsToTermedOpponent') && warModuleSource.includes('for (const retal of visibleRetals())'), 'Termed-war opponent retals are not consistently filtered from the GUI and alerts.');
assert(warModuleSource.includes('function onAttackPage()') && warModuleSource.includes('dialog___') && warModuleSource.includes("'war.mug.report'"), 'Mug result capture is not narrowly scoped to Torn attack-result dialogs.');
assert(warServiceSource.includes("'war.mug.report': recordMugResult") && warServiceSource.includes('torn_attack_result_dom'), 'Scraped mug results are not connected to local War reporting.');
assert(warModuleSource.includes('.item-action [data-role="retrieve"].active') && warModuleSource.includes('.retrieve-cont .retrieve-yes'), 'The Armory Recaller does not use Torn\'s explicit retrieve and confirmation controls.');
assert(warServiceSource.includes("'war.armory.members'") && warServiceSource.includes("'war.armory.request'"), 'The extension is missing its cached Armory status or request routes.');
assert(warModuleSource.includes("button.textContent = 'Request Item'") && warModuleSource.includes('/^(revitalize|warlord)$/i') && warModuleSource.includes('slink-armory-request-cell'), 'Warlord and Revitalize item requests are not inserted into a separate Torn armory column.');
assert(warModuleSource.includes('grid-template-columns:62px minmax(170px,1fr) 145px 70px 120px 112px 126px') && !warModuleSource.includes('flex-wrap:wrap !important; min-width:780px'), 'Armory rows do not use a uniform fixed-column layout.');
assert(warModuleSource.includes("actionSlot.className = 'slink-armory-request-action'") && warModuleSource.includes('else row.append(cell)'), 'Every Armory row does not reserve the same SLINK status and request cell.');
assert(warModuleSource.includes('NO INSIDE HITS DURING MAJOR BONUS WINDOWS') && warModuleSource.includes('INSIDE_WINDOWS'), 'The Termed-war major-window inside gate is missing.');
assert(warModuleSource.includes('profile-button-attack') && warModuleSource.includes('renderProfileAttackGate'), 'The inside gate does not cover Torn profile attack buttons.');
assert(warModuleSource.includes('data-war-retal-dismiss') && warModuleSource.includes('retalDismissKey'), 'Per-player retaliation dismissal is missing.');
assert(warModuleSource.includes("activeTab = await SLINK.core.storage.get('ui.war.activeTab.v1'"), 'The in-Torn War panel does not remember its selected tab.');
assert(dashboardHtml.includes('id="war-min-ff"') && dashboardHtml.includes('id="war-max-ff"') && dashboardHtml.includes('id="war-status-filter"'), 'The extension dashboard is missing War-target Fair Fight or status filters.');
assert(warModuleSource.includes('slink-war-filter-min') && warModuleSource.includes('slink-war-filter-status') && warModuleSource.includes('ui.war.targetFilters.v1'), 'The in-Torn War panel is missing persistent Fair Fight or status filters.');
assert(dashboardHtml.includes('id="claim-target-id"') && dashboardHtml.includes('id="claim-assignee-id"') && dashboardHtml.includes('id="claim-submit"'), 'The extension dashboard is missing explicit target-to-assignee med-out controls.');
assert(warModuleSource.includes('slink-war-claim-target-id') && warModuleSource.includes('slink-war-claim-submit'), 'The in-Torn War panel is missing explicit Torn-ID med-out claiming.');
assert(!dashboardSource.includes('claim-war-target') && !warModuleSource.includes('data-war-claim='), 'Legacy per-target med-out buttons remain in the War target cards.');
assert(read('src/core/messaging.js').includes('suspendStaleContext') && read('src/core/messaging.js').includes('staleContextPromise'), 'Obsolete extension pages do not become quietly inactive after an update.');
const moduleLoaderSource = read('src/core/modules.js');
assert(moduleLoaderSource.includes('const planned = []') && moduleLoaderSource.includes('Promise.all(planned.map'), 'Torn modules are still started serially before later tabs exist.');
for (const modulePath of ['src/modules/adhd.js','src/modules/market.js','src/modules/merits.js','src/modules/dollar-bazaars.js','src/modules/player-stats.js']) {
  assert(read(modulePath).includes('await load(false);'), `${modulePath} still forces due API work during Torn page navigation.`);
}
assert(!listFiles(path.join(root, 'src')).some(file => /\.(?:js|mjs|html)$/i.test(file) && /(?:loader2?\.php|\/loader)/i.test(fs.readFileSync(file, 'utf8'))), 'An obsolete Torn loader URL remains in the extension.');
assert(warServiceSource.includes("'war.leader.claim'") && warServiceSource.includes('LOCAL_LEADER_LEASE_MS'), 'War collection does not use one extension-wide polling owner.');
assert(serviceWorkerSource.includes('chrome.alarms.clear(WAR_CYCLE_ALARM)') && !serviceWorkerSource.includes('SLINK.services.war.prepareCycle()'), 'The legacy background War poller is still active.');
assert(dashboardHtml.includes('id="war-open-armory"') && dashboardSource.includes("ui.war.requestedTab"), 'The extension dashboard is missing its Torn-only Armory launcher.');

console.log(`Validated Manifest V3 extension ${manifest.version} (${listFiles(path.join(root, 'src')).length} source files).`);

const dashboardQualityHtml = read('src/dashboard/dashboard.html');
const dashboardQualityJs = read('src/dashboard/dashboard.js');
const abroadQualityModule = read('src/modules/abroad-stocks.js');
assert(dashboardQualityHtml.includes('data-page-tab="quality"') && dashboardQualityHtml.includes('data-quality-view="abroad-stocks"'), 'Dashboard Quality of Life navigation is missing.');
assert(dashboardQualityHtml.includes('../modules/racing.js') && dashboardQualityHtml.includes('../modules/events.js'), 'Dashboard does not load the shared Quality of Life modules.');
assert(dashboardQualityJs.includes('ui.quality.activeView') && dashboardQualityJs.includes('definition.start'), 'Dashboard does not preserve or start shared Quality of Life modules.');
assert(!abroadQualityModule.includes('data-setting="tornIntelKey"'), 'The unsupported Torn Intel client-key entry is still visible.');

assert(read('src/background/faction-officer-service.js').includes('/api/faction/onboarding/sync') && read('src/background/faction-officer-service.js').includes('/officer-roles'), 'Faction onboarding sharing or role-based officer assignment service is missing.');
assert(read('src/modules/faction-officers.js').includes("requiredScopes:['admin.*']") && dashboardHtml.includes('data-quality-view="faction-officers"'), 'Admin faction-officer role settings are missing from Quality of Life.');
assert(read('src/core/adhd.js').includes("id:'factionOnboarding'") && read('src/background/adhd-service.js').includes('factionOfficer.activeAlerts'), 'Faction onboarding alerts are not integrated into Efficiency alerts.');




const contentRuntimeSource = read('src/content/content-script.js');
assert(serviceWorkerSource.includes("channel:'slink-page-activity'") && serviceWorkerSource.includes('activeTornPageTabId'), 'The extension does not enforce one active Torn page.');
assert(contentRuntimeSource.includes('claimRuntimeActivity') && contentRuntimeSource.includes('releaseRuntimeActivity') && contentRuntimeSource.includes('await SLINK.modules.stopAll()'), 'Inactive Torn pages do not suspend their modules.');
assert(contentRuntimeSource.includes('10_000') && !contentRuntimeSource.includes('2_000);'), 'The shared API ledger still synchronizes too aggressively.');
assert(!read('src/modules/leveling.js').includes('reportAttackPage') && !read('src/modules/leveling.js').includes('document.body?.innerText'), 'The obsolete attack-page status scraper remains active.');
assert(read('src/modules/events.js').includes('onHalloweenBasketPage') && read('src/modules/racing.js').includes('onRacewayPage'), 'Events or Racing DOM observers are not route-gated.');
assert(read('src/modules/market.js').includes('if (onPurchaseOpportunityPage()) schedulePurchaseOpportunityFormatting(80);'), 'Market DOM formatting still runs on unrelated pages.');
assert(read('src/modules/war.js').includes('mutationsMayContainAttackResult') && read('src/modules/chat.js').includes('hasActiveHighlights'), 'High-frequency War or Chat mutation work is not filtered.');
assert(!read('src/content/ui-shell.js').includes('backdrop-filter:blur(var(--slink-theme-panel-blur'), 'The Torn overlay still applies expensive image-theme blur.');


const chatMinimizeShell = read('src/content/ui-shell.js');
assert(chatMinimizeShell.includes("MINIMIZED_MODE_STORAGE_KEY = 'ui.main.minimizedMode'") && chatMinimizeShell.includes("getElementById('notes_settings_button')"), 'Optional Torn chat-row minimize mode is missing.');
assert(chatMinimizeShell.includes("row.insertBefore(chatButton, settingsButton)") && chatMinimizeShell.includes('messageCount___EWpiR') && chatMinimizeShell.includes('root____FDYX oneDigit___FJ3vn'), 'SLINK chat button placement or native Torn alert badge is missing.');
assert(read('src/dashboard/dashboard.html').includes('id="torn-chat-minimize"') && read('src/dashboard/dashboard.js').includes("tornMinimizedMode = event.currentTarget.checked ? 'chat' : 'bubble'"), 'Extension dashboard chat-button setting is missing.');

assert(read('src/content/ui-shell.js').includes('slink-chat-theme-icon') && read('src/content/ui-shell.js').includes('data-slink-brand-icon'), 'Halloween brand or chat icon integration is missing.');

assert(read('src/background/theme-service.js').includes('catalogHasCurrentAssets') && read('src/background/theme-service.js').includes("'?refresh=1'"), 'Theme catalog asset-schema cache migration is missing.');
