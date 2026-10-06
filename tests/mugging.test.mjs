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

assert(manifest.version === '0.18.45', 'Unexpected Phase 8 extension version.');
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
assert(!/MUGGING_SERVICE_TOKEN|X-SLINK-Service-Token/.test(serviceSource), 'A backend service secret leaked into the extension.');
assert(workerSource.includes("'mugging-service.js'") && workerSource.includes('...SLINK.services.mugging.routes'), 'Mugging background routes are not registered.');
assert(contentSource.includes('Could not apply refreshed permissions in place') && contentSource.includes('restartModules()'), 'Refreshed permissions do not restart module gating in place.');
console.log('Mugging Phase 8 rough assignment checks passed.');
