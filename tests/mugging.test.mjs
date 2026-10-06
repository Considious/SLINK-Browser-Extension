import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
function assert(condition, message) { if (!condition) throw new Error(message); }

const manifest = JSON.parse(read('manifest.json'));
const moduleSource = read('src/modules/mugging.js');
const contentSource = read('src/content/content-script.js');

assert(manifest.version === '0.18.44', 'Unexpected Phase 7 extension version.');
assert(manifest.content_scripts.some(entry => entry.js?.includes('src/modules/mugging.js')), 'Mugging module is not loaded by the Torn content script.');
assert(moduleSource.includes("requiredScopes:[REQUIRED_SCOPE]") && moduleSource.includes("const REQUIRED_SCOPE = 'slink.mugging'"), 'Mugging is not gated exclusively by the backend-managed scope.');
assert(!/3853023|factionId|faction_id/.test(moduleSource), 'Mugging contains a hard-coded tester, owner, or faction override.');
assert(moduleSource.includes("SLINK.core.storage.get(SETTINGS_KEY") && moduleSource.includes("SLINK.core.storage.get(CACHE_KEY"), 'Mugging settings or cached results are not local-first.');
assert(moduleSource.includes("SLINK.core.messaging.send('targetList.add'") && moduleSource.includes("tags:['Mug']"), 'Mugging does not use the shared explicit Target List handoff.');
assert(!/fetch\s*\(|requestJson|tornApi|ffscouter/i.test(moduleSource), 'Phase 7 Mugging UI must not start API or Fair Fight work.');
assert(contentSource.includes('Could not apply refreshed permissions in place') && contentSource.includes('restartModules()'), 'Refreshed permissions do not restart module gating in place.');
console.log('Mugging Phase 7 permission and UI checks passed.');
