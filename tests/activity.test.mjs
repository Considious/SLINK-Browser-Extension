import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const limiterSource = fs.readFileSync(new URL('../src/core/torn-api-limiter.js', import.meta.url), 'utf8');
const marketServiceSource = fs.readFileSync(new URL('../src/background/market-service.js', import.meta.url), 'utf8');

function runtimeFor(source, initial = {}) {
  const values = new Map(Object.entries(initial));
  const alarms = new Map();
  const SLINK_EXTENSION = {
    core:{
      storage:{
        async get(key, fallback) { return values.has(key) ? values.get(key) : fallback; },
        async set(key, value) { values.set(key, value); return value; }
      },
      market:{
        normalizeSettings(value) { return value || {}; }
      }
    },
    services:{},
    define(group, name, value) {
      this[group][name] = value;
      return value;
    }
  };
  const context = {
    console,
    crypto:{ randomUUID:() => 'test-id' },
    setTimeout,
    clearTimeout,
    SLINK_EXTENSION,
    chrome:{
      alarms:{
        async create(name, options) { alarms.set(name, options); },
        async get(name) { return alarms.get(name) || null; },
        async clear(name) { return alarms.delete(name); }
      }
    }
  };
  context.globalThis = context;
  vm.runInNewContext(source, context);
  return { api:SLINK_EXTENSION, values, alarms };
}

test('shared contribution expands into spare capacity but preserves interactive headroom', async () => {
  const now = Date.now();
  const normal = Array.from({ length:10 }, (_, index) => ({
    at:now - index,
    id:`normal-${index}`,
    script:'interactive',
    priority:'normal',
    method:'GET',
    endpoint:'/interactive',
    tabId:'test'
  }));
  const contribution = Array.from({ length:12 }, (_, index) => ({
    at:now - 100 - index,
    id:`contribution-${index}`,
    script:'contribution',
    priority:'contribution',
    method:'GET',
    endpoint:'/contribution',
    tabId:'test'
  }));
  const { api, values } = runtimeFor(limiterSource, {
    'core.tornApiLedger.v1':{ events:[...normal, ...contribution], cooldownUntil:0 }
  });
  const capacity = await api.core.tornApiLimiter.getContributionCapacity();
  assert.equal(capacity.available, 28);
  assert.equal(capacity.ceiling, 40);
  assert.equal(capacity.interactiveReserve, 10);

  const reservation = await api.core.tornApiLimiter.reserveContribution({
    wait:false,
    endpoint:'/v2/user/1/basic'
  });
  assert.equal(reservation.contributionCount, 13);
  assert.equal(values.get('core.tornApiLedger.v1').events.at(-1).priority, 'contribution');
});

test('contribution yields at the safety boundary while interactive high priority remains available', async () => {
  const now = Date.now();
  const events = Array.from({ length:50 }, (_, index) => ({
    at:now - index,
    id:`normal-${index}`,
    script:'interactive',
    priority:'normal',
    method:'GET',
    endpoint:'/interactive',
    tabId:'test'
  }));
  const { api } = runtimeFor(limiterSource, {
    'core.tornApiLedger.v1':{ events, cooldownUntil:0 }
  });
  await assert.rejects(
    api.core.tornApiLimiter.reserveContribution({ wait:false }),
    error => error?.code === 'SLINK_TORN_API_LIMIT'
  );
  const interactive = await api.core.tornApiLimiter.reserve({ wait:false, priority:'high' });
  assert.equal(interactive.count, 51);
});

test('Market Watch activity expires independently after five minutes', async () => {
  const { api, values, alarms } = runtimeFor(marketServiceSource);
  const market = api.services.market;
  assert.equal((await market.activityStatus()).active, false);
  const touched = await market.touchActivity();
  assert.equal(touched.active, true);
  assert.ok(alarms.has(market.ALARM));
  const lastActiveAt = values.get('market.activity.v1').lastActiveAt;
  assert.equal((await market.activityStatus(lastActiveAt + market.INACTIVE_AFTER_MS + 1)).active, false);
});

test('module loops use independent inactivity paths and preserve lightweight War alerts', () => {
  const leveling = fs.readFileSync(new URL('../src/modules/leveling.js', import.meta.url), 'utf8');
  const market = fs.readFileSync(new URL('../src/modules/market.js', import.meta.url), 'utf8');
  const mugging = fs.readFileSync(new URL('../src/modules/mugging.js', import.meta.url), 'utf8');
  const war = fs.readFileSync(new URL('../src/modules/war.js', import.meta.url), 'utf8');
  const warService = fs.readFileSync(new URL('../src/background/war-service.js', import.meta.url), 'utf8');

  assert.match(leveling, /function cycleActive\(\)/);
  assert.match(market, /market\.activity\.touch/);
  assert.match(market, /\}, 5_000\);/);
  assert.match(mugging, /syncMuggingVisibility/);
  assert.match(war, /war\.alerts\.prepare/);
  assert.match(warService, /async function prepareAlerts\(\)/);
});
