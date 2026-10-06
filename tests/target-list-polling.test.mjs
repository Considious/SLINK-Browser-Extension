import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const values = new Map();
const alarmRows = new Map();
const refreshed = [];
const context = vm.createContext({
  console,
  URL,
  structuredClone,
  chrome:{
    alarms:{
      async get(name) { return alarmRows.get(name) || null; },
      async create(name, options) { alarmRows.set(name, { name, ...options }); }
    }
  },
  globalThis:null
});
context.globalThis = context;

function load(file) {
  vm.runInContext(
    fs.readFileSync(new URL(`../${file}`, import.meta.url), 'utf8'),
    context,
    { filename:file }
  );
}

load('src/core/runtime.js');
const SLINK = context.SLINK_EXTENSION;
SLINK.define('core', 'storage', Object.freeze({
  async get(key, fallback = null) { return values.has(key) ? structuredClone(values.get(key)) : fallback; },
  async set(key, value) { values.set(key, structuredClone(value)); }
}));
SLINK.define('core', 'format', Object.freeze({
  errorMessage(error) { return String(error?.message || error || 'Unknown error'); }
}));
load('src/core/target-list.js');

SLINK.define('services', 'playerIntelligence', Object.freeze({
  async cacheMap() { return {}; },
  async observe(value) { return value; },
  async refresh({ playerId, now = Date.now() }) {
    refreshed.push(playerId);
    return {
      fetched:true,
      reason:'api',
      nextCheckAt:now + 600_000,
      record:{ playerId, state:'Okay' }
    };
  }
}));
load('src/background/target-list-service.js');
const service = SLINK.services.targetList;
const entries = {};
for (let index = 1; index <= 100; index += 1) {
  entries[String(index)] = SLINK.core.targetList.mergeTarget(null, {
    playerId:index,
    name:`Player ${index}`,
    tags:index <= 10 ? ['Mug'] : ['Target'],
    source:'test',
    updatedAt:index
  });
}
await SLINK.core.storage.set(service.STORE_KEY, entries);

const configured = await service.configurePolling({
  enabled:true,
  intervalMinutes:10,
  mugOnly:false
});
assert.equal(configured.polling.eligibleCount, 100);
assert.equal(configured.polling.estimatedChecksPerMinute, 10);
assert.ok(alarmRows.has(service.POLL_ALARM), 'Target List polling alarm was not created.');

const now = 2_000_000_000_000;
await service.runPolling({ now });
assert.ok(refreshed.length > 0 && refreshed.length <= 10,
  'The first rolling tick checked too many targets simultaneously.');
const firstTick = refreshed.length;
await service.runPolling({ now:now + 60_000 });
assert.ok(refreshed.length - firstTick <= 10,
  'A later rolling tick exceeded its distributed per-minute share.');
assert.ok(refreshed.length < 100,
  'Rolling polling collapsed into an all-target burst.');

refreshed.length = 0;
const mugOnly = await service.configurePolling({
  enabled:true,
  intervalMinutes:5,
  mugOnly:true
});
assert.equal(mugOnly.polling.eligibleCount, 10);
assert.equal(mugOnly.polling.estimatedChecksPerMinute, 2);
await service.runPolling({ now:now + 120_000 });
assert.ok(refreshed.length > 0);
assert.ok(refreshed.every(playerId => playerId <= 10),
  'Mug-only polling checked a target without the Mug tag.');

console.log('Target List rolling polling tests passed.');
