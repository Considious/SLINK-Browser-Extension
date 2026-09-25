import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../src/modules/war.js', import.meta.url), 'utf8');
function extract(name, async = false) {
  const start = source.indexOf(`      ${async ? 'async ' : ''}function ${name}(`);
  assert(start >= 0);
  return source.slice(start, source.indexOf('\n      }', start) + 8);
}
function fixture({ eligible = true, confirmation = true, focused = true } = {}) {
  const renders = [], delays = [], clicks = [];
  const row = { querySelector(selector) {
    if (selector === '.name') return { textContent:'Ranked weapon' };
    if (selector.includes('data-role')) return { click:() => clicks.push('open') };
    if (selector.includes('retrieve-yes')) return confirmation ? { getClientRects:() => [1], click:() => clicks.push('confirm') } : null;
    return null;
  } };
  const context = vm.createContext({
    armoryWhitelist:new Set(), armoryBorrower:() => ({ id:'1' }), armoryBusy:false, fullUi:true, armoryMode:'ranked-all', armoryStatus:'', armoryState:'',
    pageIsFocused:() => focused,
    activeArmoryTab:() => ({ querySelectorAll:() => [row] }),
    armoryTabKind:() => 'weapons',
    armoryEligibility:() => eligible ? { name:'Borrower' } : null,
    SLINK:{ core:{ format:{ errorMessage:error => error.message } } },
    setTimeout:(callback, delay) => { delays.push(delay); callback(); }
  });
  context.render = () => renders.push({ busy:context.armoryBusy, status:context.armoryStatus });
  vm.runInContext(extract('armorySetStatus') + '\n' + extract('retrieveOneArmoryItem', true) + '\n' + extract('retrieveArmoryItem', true), context);
  return { context, renders, delays, clicks };
}
const success = fixture();
const first = success.context.retrieveArmoryItem();
await success.context.retrieveArmoryItem(); // Double-click while confirmation is pending.
await first;
assert.deepEqual(success.clicks, ['open', 'confirm']);
assert.equal(success.renders[0].busy, true, 'Disable immediately while retrieval is running');
assert.equal(success.renders.at(-1).busy, false, 'Re-enable immediately after retrieval');
assert.deepEqual(success.delays, [50], 'Only wait for Torn confirmation, never the ten-second War cycle');
for (const options of [{ eligible:false }, { confirmation:false }, { focused:false }]) {
  const run = fixture(options);
  await run.context.retrieveArmoryItem();
  assert.equal(run.context.armoryBusy, false);
  assert.equal(run.renders.at(-1).busy, false, 'Empty/error/focus exits must restore the button');
  assert(!run.clicks.includes('confirm'));
}
const next = { textContent:'Next', disabled:false, classList:{ contains:() => false }, matches:() => true, getAttribute:name => name === 'href' ? '#armoury-page-2' : '', click:() => success.clicks.push('next') };
const page = { querySelector:() => null, querySelectorAll:() => [next] };
success.context.document = { querySelector:() => null };
success.context.activeArmoryTab = () => page;
success.context.location = { hash:'#page-1' };
vm.runInContext(extract('findNextArmoryPageControl') + '\n' + extract('nextArmoryPage'), success.context);
success.context.nextArmoryPage();
assert(success.clicks.includes('next'));
assert.equal(success.context.location.hash, 'armoury-page-2', 'Exact Torn hash route fallback was not applied');
next.disabled = true;
assert.equal(success.context.findNextArmoryPageControl(page), null);
console.log('Armory immediate button recovery, double-click guard, errors, empty pages and pagination passed.');
