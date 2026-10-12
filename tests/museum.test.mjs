import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';

const code = fs.readFileSync(new URL('../src/core/museum.js', import.meta.url), 'utf8');
const sandbox = { console, globalThis:null, SLINK_EXTENSION:{ core:{}, define(namespace,name,value){ this[namespace] ||= {}; this[namespace][name] = value; } } };
sandbox.globalThis = sandbox;
vm.runInNewContext(code, sandbox);
const museum = sandbox.SLINK_EXTENSION.core.museum;

const catalog = museum.SETS.flatMap((set, setIndex) => set.items.map((entry, itemIndex) => ({
  id:(setIndex + 1) * 100 + itemIndex,
  name:entry.name,
  type:set.travel ? 'Plushie' : 'Artifact',
  marketPrice:1000 + itemIndex
})));
const inventoryItems = museum.SETS.flatMap((set, setIndex) => set.items.map((entry, itemIndex) => ({
  id:(setIndex + 1) * 100 + itemIndex,
  name:entry.name,
  amount:entry.amount
})));
const full = museum.buildStatus({ inventory:{ items:inventoryItems } }, catalog);
assert.equal(full.summary.completed, museum.SETS.length);
assert.ok(full.summary.redeemablePoints > 0);

const missing = museum.buildStatus({ inventory:{ items:inventoryItems.filter(row => row.name !== 'Jaguar Plushie') } }, catalog);
const plushies = missing.sets.find(set => set.id === 'plushies');
assert.equal(plushies.complete, false);
assert.equal(plushies.items.find(item => item.name === 'Jaguar Plushie').needed, 1);
assert.equal(plushies.items.find(item => item.name === 'Jaguar Plushie').itemId, 100);

assert.equal(museum.canonicalName('Quran Script : Ali'), 'Companion Script : Ali');
assert.equal(museum.setById('flowers').travel, true);
console.log('museum tests passed');
