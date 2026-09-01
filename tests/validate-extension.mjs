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
assert(
  manifest.host_permissions.length === 6 &&
  manifest.host_permissions.includes('https://www.torn.com/*') &&
  manifest.host_permissions.includes('https://api.torn.com/*') &&
  manifest.host_permissions.includes('https://ffscouter.com/*') &&
  manifest.host_permissions.includes('https://slinkyleveling.richard-johnson554.workers.dev/*') &&
  manifest.host_permissions.includes('https://slinkcontributionworker.richard-johnson554.workers.dev/*') &&
  manifest.host_permissions.includes('https://slinkwarworker.richard-johnson554.workers.dev/*'),
  'Required host access must include Torn, Torn API, FFScouter, and all SLINK Workers.'
);
assert(
  !Object.prototype.hasOwnProperty.call(manifest, 'optional_host_permissions'),
  'Core SLINK services must not be presented as optional access.'
);

assertFile(manifest.background.service_worker);
assertFile(manifest.action.default_popup);
assertFile(manifest.options_ui.page);
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

const dashboardHtml = read('src/dashboard/dashboard.html');
const dashboardSource = read('src/dashboard/dashboard.js');
const dashboardIds = new Set([...dashboardHtml.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]));
for (const match of dashboardSource.matchAll(/byId\('([^']+)'\)/g)) {
  assert(dashboardIds.has(match[1]), `Dashboard script references missing element #${match[1]}.`);
}
assert(/function setBusy\(button, busy\)\s*{\s*if \(button\)/.test(dashboardSource), 'Dashboard busy-state helper must tolerate removed or unavailable controls.');
assert(dashboardHtml.includes('id="theme-options"'), 'Dashboard theme selector is missing.');
assert(dashboardHtml.includes('id="player-stats-refresh"') && dashboardHtml.includes('id="ps-armory-balance"'), 'The compact player-stat panel is missing.');
assert(read('src/background/player-stats-service.js').includes("'playerStats.refresh'") && read('src/background/player-stats-service.js').includes('personalstats,money,workstats'), 'The local daily Torn player-stat collector is missing or not combined.');
assert(!read('src/background/player-stats-service.js').includes('workerClient') && !read('src/background/player-stats-service.js').includes('D1'), 'Player stats must not use a SLINK Worker or D1.');
assert(read('src/background/theme-service.js').includes('/api/themes'), 'Background theme catalog route is missing.');
assert(!manifest.host_permissions.some(origin => /githubusercontent|github\.com/.test(origin)), 'The extension must receive theme data through its existing Worker, not direct GitHub host access.');
const uiShellSource = read('src/content/ui-shell.js');
assert(uiShellSource.includes('setTheme'), 'Torn UI shell does not support live themes.');
assert(uiShellSource.includes('ui.main.collapsed') && uiShellSource.includes('bubble-coil'), 'Torn UI shell does not provide the persistent theme-aware collapse bubble.');
assert(uiShellSource.includes('setBubbleAlert') && uiShellSource.includes('data-alert-kind="retal"') && uiShellSource.includes('data-alert-kind="armory"'), 'The collapse bubble is missing retal or officer armory alert states.');
assert(uiShellSource.includes('ui.main.activeModule'), 'The Torn shell does not remember the selected SLINK module.');
assert(uiShellSource.includes('async function restore()'), 'Torn UI shell does not provide an in-place recovery path.');
assert(!uiShellSource.includes('Pop out') && !uiShellSource.includes('setPopped'), 'The broken Torn module pop-out control is still packaged.');
assert(read('src/background/service-worker.js').includes("'ui.torn.restore'"), 'The extension cannot repush its GUI to open Torn tabs.');
const warModuleSource = read('src/modules/war.js');
const warServiceSource = read('src/background/war-service.js');
const serviceWorkerSource = read('src/background/service-worker.js');
assert(warModuleSource.includes("activeTab === 'armory'") && warModuleSource.includes('pageIsFocused()'), 'The in-Torn War module is missing its focused-page Armory Recaller.');
assert(warModuleSource.includes('.item-action [data-role="retrieve"].active') && warModuleSource.includes('.retrieve-cont .retrieve-yes'), 'The Armory Recaller does not use Torn\'s explicit retrieve and confirmation controls.');
assert(warServiceSource.includes("'war.armory.members'") && warServiceSource.includes("'war.armory.request'"), 'The extension is missing its cached Armory status or request routes.');
assert(warModuleSource.includes("button.textContent = 'Request Item'") && warModuleSource.includes('/^(revitalize|warlord)$/i') && warModuleSource.includes('slink-armory-request-cell'), 'Warlord and Revitalize item requests are not inserted into a separate Torn armory column.');
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
assert(!listFiles(path.join(root, 'src')).some(file => /\.(?:js|mjs|html)$/i.test(file) && /(?:loader2?\.php|\/loader)/i.test(fs.readFileSync(file, 'utf8'))), 'An obsolete Torn loader URL remains in the extension.');
assert(warServiceSource.includes("'war.leader.claim'") && warServiceSource.includes('LOCAL_LEADER_LEASE_MS'), 'War collection does not use one extension-wide polling owner.');
assert(serviceWorkerSource.includes('chrome.alarms.clear(WAR_CYCLE_ALARM)') && !serviceWorkerSource.includes('SLINK.services.war.prepareCycle()'), 'The legacy background War poller is still active.');
assert(dashboardHtml.includes('id="war-open-armory"') && dashboardSource.includes("ui.war.requestedTab"), 'The extension dashboard is missing its Torn-only Armory launcher.');

console.log(`Validated Manifest V3 extension ${manifest.version} (${listFiles(path.join(root, 'src')).length} source files).`);
