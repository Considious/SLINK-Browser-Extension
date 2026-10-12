import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const text = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const permissions = text('src/core/permissions.js');
assert.ok(!permissions.includes('SOLE_ADMIN_USER_ID'));
assert.ok(permissions.includes("scope === '*' || scope === 'admin.*'"));

const expected = new Map([
  ['src/modules/abroad-stocks.js', 'slink.qol.abroad-stocks'],
  ['src/modules/bounties.js', 'slink.combat.bounties'],
  ['src/modules/dollar-bazaars.js', 'slink.efficiency.dollar-bazaars'],
  ['src/modules/player-stats.js', 'slink.combat.player-stats'],
  ['src/modules/racing.js', 'slink.qol.racing'],
  ['src/modules/target-list.js', 'slink.combat.target-list'],
  ['src/core/merits.js', 'slink.efficiency.merits']
]);
for (const [path, scope] of expected) assert.ok(text(path).includes(scope), `${path} is missing ${scope}`);
assert.ok(text('src/modules/travel-safety.js').includes('requiredScopes:[]'));
console.log('Permission sweep validation passed.');
