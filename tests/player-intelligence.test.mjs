import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(testDirectory, '..');
const values = new Map();
let apiCalls = 0;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function load(context, relativePath) {
  vm.runInContext(
    fs.readFileSync(path.join(root, relativePath), 'utf8'),
    context,
    { filename:relativePath }
  );
}

const context = vm.createContext({ console, URL });
context.globalThis = context;
load(context, 'src/core/runtime.js');

const SLINK = context.SLINK_EXTENSION;
SLINK.define('core', 'storage', Object.freeze({
  async get(key, fallback = null) {
    return values.has(key) ? values.get(key) : fallback;
  },
  async set(key, value) {
    values.set(key, structuredClone(value));
  },
  async remove(key) {
    values.delete(key);
  }
}));
SLINK.define('core', 'tornApiLimiter', Object.freeze({
  async reserve() { return { reserved:true }; }
}));
SLINK.define('core', 'http', Object.freeze({
  async requestJson() {
    apiCalls += 1;
    await Promise.resolve();
    return {
      profile:{
        id:123,
        name:'API Player',
        level:50,
        status:{ state:'Okay', description:'Okay', until:0 }
      }
    };
  }
}));

load(context, 'src/core/player-intelligence.js');
load(context, 'src/background/player-intelligence-service.js');

const CORE = SLINK.core.playerIntelligence;
const service = SLINK.services.playerIntelligence;
const now = Date.now();
await SLINK.core.storage.set('access.settings.v1', { tornKey:'test-key' });

const observed = await service.observe({
  playerId:123,
  name:'DOM Player',
  state:'Hospital',
  until:Math.floor((now + 8 * 60_000) / 1000),
  description:'In hospital',
  source:'bounty-profile',
  observedAt:now,
  checkedAt:now
});
assert(observed.state === 'Hospital', 'DOM observation was not stored.');

const timerResult = await service.refresh({ playerId:123, now });
assert(timerResult.fetched === false && timerResult.reason === 'known-timer',
  'Known Hospital timer did not suppress an API request.');
assert(apiCalls === 0, 'Known Hospital timer consumed an API request.');

const forced = await service.refresh({ playerId:123, forceApi:true });
assert(forced.fetched === true && apiCalls === 1,
  'Explicit forced refresh did not perform exactly one API request.');

await SLINK.core.storage.set(service.CACHE_KEY, {});
apiCalls = 0;
const [first, second] = await Promise.all([
  service.refresh({ playerId:123, maxAgeMs:0 }),
  service.refresh({ playerId:123, maxAgeMs:0 })
]);
assert(first.fetched && second.fetched && apiCalls === 1,
  'Concurrent player refreshes were not deduplicated.');

await service.observe({
  playerId:123,
  state:'Okay',
  source:'profile-dom',
  observedAt:now + 20_000
});
await service.observe({
  playerId:123,
  state:'Hospital',
  until:Math.floor((now + 60_000) / 1000),
  source:'older-observation',
  observedAt:now + 10_000
});
const merged = (await service.get({ playerId:123 })).record;
assert(merged.state === 'Okay',
  'An older observation replaced newer player status intelligence.');

const expired = CORE.effectiveStatus({
  playerId:999,
  state:'Jail',
  until:Math.floor((now - 1_000) / 1000),
  source:'test',
  observedAt:now - 60_000
}, now);
assert(expired.state === 'Okay' && expired.presumed === true,
  'Expired known timer did not become presumed Okay.');

const missing = CORE.requestDecision(null, { now });
assert(missing.required && missing.reason === 'missing',
  'Missing intelligence did not request a lookup.');

console.log('Player intelligence tests passed.');
