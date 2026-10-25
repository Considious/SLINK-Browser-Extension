import assert from 'node:assert/strict';
import fs from 'node:fs';

const service = fs.readFileSync(new URL('../src/background/mugging-service.js', import.meta.url), 'utf8');
const moduleSource = fs.readFileSync(new URL('../src/modules/mugging.js', import.meta.url), 'utf8');

assert.doesNotThrow(() => new Function(service));
assert.doesNotThrow(() => new Function(moduleSource));
assert.match(service, /const OWN_STATS_KEY = 'player\.ownBattleStats\.v1'/);
assert.match(service, /const LEGACY_OWN_STATS_KEY = 'mugging\.ownBattleStats\.v1'/);
assert.match(service, /const OWN_STATS_TTL_MS = 15 \* 60_000/);
assert.match(service, /async function storedOwnBattleStats/);
assert.match(service, /userBattleStats:ownProfile\.total > 0 \? ownProfile\.total : 0/);
assert.match(service, /sharedData\.personal/);
assert.match(service, /sharedData\.peekPersonal/);
assert.match(service, /userBattleStats,/);
assert.match(service, /'battleStats\.status':storedOwnBattleStats/);
assert.match(moduleSource, /forceBattleStats:true/);

console.log('Extension shared battle-stat freshness checks passed.');
