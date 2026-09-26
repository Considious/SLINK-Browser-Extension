import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const runtime = {
  core:Object.create(null), modules:Object.create(null), services:Object.create(null),
  define(group, name, value) { this[group][name] = value; return value; }
};
const context = vm.createContext({ globalThis:null, SLINK_EXTENSION:runtime });
context.globalThis = context;
vm.runInContext(fs.readFileSync(path.join(root, 'src/core/bounties.js'), 'utf8'), context);

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const bounties = runtime.core.bounties;
const merged = bounties.mergeTargets([], [
  { target_id:10, target_name:'Ten', target_level:50, reward:300000, quantity:3 },
  { target_id:11, target_name:'Eleven', reward:400000, quantity:1 },
  { target_id:10, target_name:'Ten', reward:500000, quantity:2 },
  { target_id:10, target_name:'Ten', reward:500000, quantity:4 }
]);
assert(merged.length === 2, 'Bounty rows must deduplicate by target player.');
assert(merged[0].id === 10 && merged[0].highestReward === 500000, 'The highest individual bounty must be retained.');
assert(merged[0].highestQuantity === 6, 'Equal highest-reward quantities must be combined.');

const now = Date.now();
const candidates = bounties.filteredCandidates(merged, {
  10:{ fairFight:2, bsEstimate:1000000, checkedAt:now },
  11:{ fairFight:2, bsEstimate:1000000, checkedAt:now }
}, {
  10:{ state:'Hospital', until:Math.floor(now / 1000) - 1 },
  11:{ state:'Hospital', until:Math.floor(now / 1000) + 3600 }
}, { enabled:true, minimumReward:300000, includeUnknownEstimates:false, statusFilter:'hide-hospital' }, now);
assert(candidates.length === 1 && candidates[0].id === 10, 'An expired hospital timer must become locally presumed okay without an API recheck.');
assert(candidates[0].status.label === 'Presumed Okay', 'Expired hospital status must be labeled Presumed Okay.');

const settings = bounties.normalizeSettings({ tornCallsPerMinute:500, ffBatchesPerMinute:0 });
assert(settings.tornCallsPerMinute === 20, 'Bounty Torn traffic must cap at 20 calls per minute.');
assert(settings.ffBatchesPerMinute === 1, 'FFScouter traffic must enforce a positive batch limit.');

console.log('Bounties tests passed.');

