import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const context = vm.createContext({ console, URL, globalThis:null });
context.globalThis = context;
for (const file of [
  'src/core/runtime.js',
  'src/core/player-intelligence.js',
  'src/content/player-intelligence-dom.js'
]) {
  vm.runInContext(
    fs.readFileSync(new URL(`../${file}`, import.meta.url), 'utf8'),
    context,
    { filename:file }
  );
}

const DOM = context.SLINK_EXTENSION.core.playerIntelligenceDom;
assert.equal(DOM.detectState('Hospitalized for 8 minutes'), 'Hospital');
assert.equal(DOM.detectState('Traveling to Mexico'), 'Traveling');
assert.equal(DOM.detectState('Federal jail'), 'Federal');
assert.equal(DOM.parseRemainingMs('1h 2m 3s'), 3_723_000);
assert.equal(DOM.parseRemainingMs('00:05:30'), 330_000);

console.log('DOM player intelligence parser tests passed.');
