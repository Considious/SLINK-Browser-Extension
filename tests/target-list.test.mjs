import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const context = vm.createContext({
  console,
  globalThis:null
});
context.globalThis = context;
for (const file of ['src/core/runtime.js', 'src/core/target-list.js']) {
  vm.runInContext(fs.readFileSync(new URL(`../${file}`, import.meta.url), 'utf8'), context, { filename:file });
}

const CORE = context.SLINK_EXTENSION.core.targetList;

const first = CORE.mergeTarget(null, {
  playerId:123456,
  name:'First Name',
  tags:['Mug', 'Target', 'mug'],
  description:'High-value target',
  source:'manual',
  sourceContext:{ reason:'testing' },
  updatedAt:1000
});
assert.equal(first.playerId, 123456);
assert.deepEqual([...first.tags], ['Mug', 'Target']);
assert.equal(first.sources.length, 1);
assert.equal(first.sources[0].context.reason, 'testing');

const merged = CORE.mergeTarget(first, {
  playerId:123456,
  name:'Updated Name',
  tags:['War'],
  source:'war',
  sourceContext:{ warId:'abc' },
  updatedAt:2000
});
assert.equal(merged.id, 123456);
assert.deepEqual([...merged.tags], ['Mug', 'Target', 'War']);
assert.equal(merged.sources.length, 2);
assert.equal(merged.sources.find(source => source.source === 'manual').context.reason, 'testing');
assert.equal(merged.sources.find(source => source.source === 'war').context.warId, 'abc');
assert.equal(merged.description, 'High-value target');

const edited = CORE.updateTarget(merged, {
  playerId:123456,
  tags:['Level'],
  description:'',
  updatedAt:3000
});
assert.deepEqual([...edited.tags], ['Level']);
assert.equal(edited.description, '');
assert.equal(edited.sources.length, 2);

const view = CORE.enrichTarget(edited, {
  status:{ state:'Hospital', until:9999999999 },
  checkedAt:2500,
  lastSeenMugged:1500,
  bountyCount:2,
  bountyTotal:3500000
});
assert.equal(view.status.state, 'Hospital');
assert.equal(view.lastSeenMugged, 1500);
assert.equal(view.bountyCount, 2);
assert.equal(view.bountyTotal, 3500000);

assert.throws(() => CORE.normalizeTarget({ playerId:0 }), /valid Torn player ID/);
console.log('Target List core tests passed');
