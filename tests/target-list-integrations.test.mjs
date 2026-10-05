import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [leveling, bounties, war] = await Promise.all([
  readFile(new URL('../src/modules/leveling.js', import.meta.url), 'utf8'),
  readFile(new URL('../src/modules/bounties.js', import.meta.url), 'utf8'),
  readFile(new URL('../src/modules/war.js', import.meta.url), 'utf8')
]);

assert.match(leveling, /data-leveling-save-target/);
assert.match(leveling, /targetList\.add/);
assert.match(leveling, /tags:\['Level'\]/);
assert.match(leveling, /source:'leveling'/);

assert.match(bounties, /data-bounty-save-target/);
assert.match(bounties, /targetList\.add/);
assert.match(bounties, /tags:\['Target'\]/);
assert.match(bounties, /source:'bounties'/);

assert.match(war, /data-war-save-source="war"/);
assert.match(war, /data-war-save-source="outside"/);
assert.match(war, /targetList\.add/);
assert.match(war, /source === 'outside' \? 'outside-targets' : 'war'/);
assert.match(war, /tags:source === 'war' \? \['War'\] : \['Target'\]/);

console.log('Target List source integration tests passed.');
