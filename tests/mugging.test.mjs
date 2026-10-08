import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
function assert(condition, message) { if (!condition) throw new Error(message); }

const manifest = JSON.parse(read('manifest.json'));
const moduleSource = read('src/modules/mugging.js');
const serviceSource = read('src/background/mugging-service.js');
const workerSource = read('src/background/service-worker.js');
const contentSource = read('src/content/content-script.js');
const warSource = read('src/modules/war.js');
for (const [label, source] of [['Mugging service', serviceSource], ['Mugging module', moduleSource]]) {
  try { new Function(source); }
  catch (error) { throw new Error(`${label} has a parse-time syntax error: ${error.message}`); }
}

assert(manifest.version === '0.18.49', 'Unexpected attack-frame safety extension version.');
assert(manifest.host_permissions.includes('https://slinkmuggingworker.richard-johnson554.workers.dev/*'), 'Mugging Worker host permission is missing.');
assert(manifest.content_scripts.some(entry => entry.js?.includes('src/modules/mugging.js')), 'Mugging module is not loaded by the Torn content script.');
assert(moduleSource.includes("requiredScopes:[REQUIRED_SCOPE]") && moduleSource.includes("const REQUIRED_SCOPE = 'slink.mugging'"), 'Mugging is not gated exclusively by the backend-managed scope.');
assert(!/3853023|factionId|faction_id/.test(moduleSource), 'Mugging contains a hard-coded tester, owner, or faction override.');
assert(moduleSource.includes("SLINK.core.messaging.send('mugging.assignments.refresh'"), 'Mugging content UI bypasses the background assignment service.');
assert(moduleSource.includes('Rough FF') && moduleSource.includes("estimateKind"), 'Mugging does not label estimates as rough.');
assert(moduleSource.includes("SLINK.core.messaging.send('targetList.add'") && moduleSource.includes("tags:['Mug']"), 'Mugging does not use the shared explicit Target List handoff.');
assert(!/fetch\s*\(|requestJson|ffscouter/i.test(moduleSource), 'Mugging content UI performs direct network or FFScouter work.');
assert(serviceSource.includes("SLINK.services.permissionAccess.ensureSession(false, REQUIRED_SCOPE)"), 'Assignment requests do not use the shared permission session.');
assert(serviceSource.includes("SLINK.core.tornApiLimiter.reserve"), 'Own battle stats bypass the shared Torn API limiter.');
assert(serviceSource.includes('/v2/user/battlestats') && serviceSource.includes('/api/assignments/rough'), 'Phase 8 battle-stat or assignment endpoint is missing.');
assert(serviceSource.includes("['strength', 'defense', 'speed', 'dexterity']"), 'Own battle-stat total does not include all four battle stats.');
assert(serviceSource.includes("const ACTIVE_BUDGET = 10") && serviceSource.includes("const INACTIVE_BUDGET = 5"), 'Active/inactive Mugging contribution budgets are incorrect.');
assert(serviceSource.includes("const INACTIVE_AFTER_MS = 5 * 60_000"), 'Mugging does not switch to inactive contribution after five minutes.');
assert(serviceSource.includes('/api/contributor/tasks') && serviceSource.includes("SLINK.services.playerIntelligence.refresh"), 'Contributor tasks do not use shared player intelligence.');
assert(serviceSource.includes("wait:false") && serviceSource.includes("priority:mode === 'active' ? 'normal' : 'low'"), 'Background contribution does not yield to the shared Torn API limiter.');
assert(serviceSource.includes('PENDING_KEY') && serviceSource.includes('pendingSync:true'), 'Contributor observations are not retained for synchronization.');
assert(serviceSource.includes("const SYNC_INTERVAL_MS = 6 * 60 * 60_000") && serviceSource.includes("const SYNC_BATCH_SIZE = 100"), 'Phase 10 synchronization is not batched on the six-hour schedule.');
assert(serviceSource.includes('/api/contributor/reports') && serviceSource.includes('acknowledged_report_ids'), 'Phase 10 does not use acknowledged contributor-report batches.');
assert(serviceSource.includes("SLINK.core.storage.set(PENDING_KEY, remaining)"), 'Acknowledged observations are not removed from the pending queue.');
assert(serviceSource.includes("'mugging.contribution.sync'"), 'Manual/background Phase 10 synchronization route is missing.');
assert(serviceSource.includes("if (mode === 'active')") && serviceSource.includes('maybeRefreshActiveAssignments'), 'Inactive users can still refresh personal Mugging assignments.');
assert(moduleSource.includes("SLINK.core.messaging.send('mugging.activity.touch'"), 'Mugging UI activity is not reported to the Phase 9 scheduler.');
assert(moduleSource.includes('cached list visible') && moduleSource.includes('up to 5/min'), 'Mugging UI does not explain inactive contribution and cached results.');
assert(!/MUGGING_SERVICE_TOKEN|X-SLINK-Service-Token/.test(serviceSource), 'A backend service secret leaked into the extension.');
assert(workerSource.includes("'mugging-service.js'") && workerSource.includes('...SLINK.services.mugging.routes'), 'Mugging background routes are not registered.');
assert(workerSource.includes('SLINK.services.mugging.ensureAlarm()') && workerSource.includes('SLINK.services.mugging.runContribution()'), 'The Mugging contributor alarm is not registered.');
assert(contentSource.includes('Could not apply refreshed permissions in place') && contentSource.includes('restartModules()'), 'Refreshed permissions do not restart module gating in place.');
assert(warSource.includes('let attackMugScanTimer = null') && warSource.includes('}, 120);'), 'Attack-result scanning is not throttled.');
assert(warSource.includes('reportedMugNodes.add(node)') && !warSource.includes('reportedMugNodes.delete(node)'), 'Attack-result nodes can be retried indefinitely.');
assert(!warSource.includes('recordMugResultNode(node); });'), 'Attack-result reporting still contains a recursive refresh callback.');
console.log('Mugging Phase 10 contributor synchronization checks passed.');
