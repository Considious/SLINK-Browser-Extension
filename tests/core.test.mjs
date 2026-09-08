import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(testDirectory, '..');
const values = new Map();

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function load(context, relativePath) {
  const source = fs.readFileSync(path.join(root, relativePath), 'utf8');
  vm.runInContext(source, context, { filename: relativePath });
}

const chrome = {
  storage: {
    local: {
      async get(key) {
        if (typeof key === 'string') return values.has(key) ? { [key]: values.get(key) } : {};
        return Object.fromEntries(values);
      },
      async set(entries) {
        for (const [key, value] of Object.entries(entries)) values.set(key, value);
      },
      async remove(key) {
        for (const item of Array.isArray(key) ? key : [key]) values.delete(item);
      }
    }
  },
  permissions: {
    async contains() { return true; }
  },
  runtime: {
    id: 'test-extension',
    async sendMessage() { return { ok: true, data: { echoed: true } }; }
  }
};

const context = vm.createContext({
  chrome,
  console,
  fetch: async input => ({
    ok: true,
    status: 200,
    text: async () => JSON.stringify({
      ok: true,
      service: 'SLINK Leveling API',
      version: 'test-worker',
      ...(String(input).endsWith('/api/health') ? {
        database: 'connected',
        consent_database: 'connected',
        permissions_database: 'connected'
      } : {})
    })
  }),
  setTimeout,
  clearTimeout,
  URL
});
context.globalThis = context;

for (const file of [
  'src/core/runtime.js',
  'src/core/format.js',
  'src/core/storage.js',
  'src/core/permissions.js',
  'src/core/adhd.js',
  'src/core/market.js',
  'src/core/merits.js',
  'src/core/war.js',
  'src/core/themes.js',
  'src/core/messaging.js',
  'src/core/modules.js',
  'src/core/http.js',
  'src/core/worker-client.js',
  'src/core/torn-api-limiter.js'
]) load(context, file);

const SLINK = context.SLINK_EXTENSION;
assert(SLINK.VERSION === '0.18.0', 'Unexpected runtime version.');
assert((await SLINK.core.messaging.send('echo')).echoed === true, 'Runtime messaging did not return background data.');
assert(SLINK.core.format.escapeHtml('<a>') === '&lt;a&gt;', 'HTML escaping failed.');
assert(SLINK.core.format.shortNumber(1_250_000) === '1.25M', 'Short-number formatting failed.');

const permissions = SLINK.core.permissions;
assert(Object.values(permissions.BROWSER_CAPABILITIES).every(capability => capability.optional === false), 'A core host was marked optional.');
assert(permissions.BROWSER_CAPABILITIES.contributionWorker, 'Contribution Worker capability is missing.');
assert(SLINK.core.themes.get().tokens['--slink-bg'], 'Theme token registry is missing.');
assert(Object.keys(SLINK.core.themes.THEMES).length === 4, 'Expected the free theme and three premium SLINK themes.');
assert(SLINK.core.themes.resolve('slinky-underglow', { userId:12, scopes:[] }).id === 'slink-dark', 'Locked theme did not fall back safely.');
assert(SLINK.core.themes.resolve('slinky-underglow', { userId:12, scopes:['slink.theme.underglow'] }).id === 'slinky-underglow', 'Granted theme permission was not honored.');
assert(SLINK.core.themes.resolve('slinky-black-chrome', { userId:3853023, scopes:['admin.*'] }).id === 'slinky-black-chrome', 'Sole administrator did not unlock all themes.');
const remoteThemes = Object.values(SLINK.core.themes.THEMES).map(theme => ({
  id:theme.id, label:theme.label, description:theme.description, scope:theme.scope,
  ornament:theme.ornament, swatch:[...theme.swatch], tokens:{ ...theme.tokens }
}));
remoteThemes.push({
  id:'slinky-test', label:'Slinky Test', description:'Validated remote visual tokens.',
  scope:'slink.theme.test', ornament:'coil', swatch:['#112233','#445566','#778899'],
  tokens:{ '--slink-accent':'#445566' }
});
SLINK.core.themes.installCatalog({ schemaVersion:1, revision:'test.1', themes:remoteThemes });
assert(SLINK.core.themes.list({ userId:12, scopes:['slink.theme.test'] }).some(theme => theme.id === 'slinky-test' && theme.unlocked), 'Validated remote theme was not installed.');
let rejectedRemoteCode = false;
try {
  SLINK.core.themes.validateCatalog({ schemaVersion:1, revision:'bad.1', themes:[...remoteThemes.slice(0, 4), { ...remoteThemes[4], tokens:{ '--slink-page-bg':'url(https://evil.test/code.js)' } }] });
} catch { rejectedRemoteCode = true; }
assert(rejectedRemoteCode, 'Remote URL/code-like theme content was not rejected.');
assert(permissions.hasScope({ scopes: ['slink.level'] }, 'slink.level'), 'Exact scope matching failed.');
assert(permissions.hasScope({ userId:3853023, scopes: ['admin.*'] }, 'admin.users'), 'Wildcard scope matching failed.');
assert(!permissions.hasScope({ roles: ['admin'], scopes: ['slink.level'] }, 'admin.users'), 'Roles must not bypass signed scope checks.');
assert(!permissions.hasScope({ userId:12, scopes:['admin.*'] }, 'admin.permissions'), 'A non-owner admin wildcard was trusted.');
const combinedPermissions = permissions.combineSnapshots(
  { userId:3853023, roles:['admin'], scopes:['admin.*','slink.level'], expiresAt:Date.now() + 100_000 },
  { userId:3853023, roles:['admin'], scopes:['admin.*','slink.war'], expiresAt:Date.now() + 200_000 }
);
assert(combinedPermissions.scopes.join(',') === 'admin.*,slink.level,slink.war', 'Product scopes were not combined without duplication.');
assert(!permissions.combineSnapshots({ userId:1, scopes:['expired.product'], expiresAt:Date.now() - 1 }).scopes.length, 'Expired product scopes remained visible.');
assert(SLINK.core.adhd.marketWatchLimit({ userId:12, scopes:['slink.adhd.marketwatch.5','slink.adhd.marketwatch.15'] }) === 15, 'Highest ADHD market-watch tier was not selected.');
const marketCatalog = SLINK.core.market.catalogItems({ items:[
  { id:1, name:'Current Shops', type:'Drug', is_tradable:true, value:{ market_price:100, shops:[{ country:'Torn', shop:'Bits n Bobs', sell_price:125 }, { country:'Mexico', shop:'Market', sell_price:110 }] } },
  { id:2, name:'Legacy Shop', type:'Other', is_tradable:true, value:{ market_price:200, sell_price:220, vendor:{ name:'Old Shop', country:'Torn' } } }
] });
assert(marketCatalog[0].shopSellPrice === 125 && marketCatalog[0].shopSellName === 'Bits n Bobs', 'Market catalog did not use the current Torn value.shops[] sell price.');
assert(marketCatalog[1].shopSellPrice === 220, 'Legacy shop-price compatibility fallback failed.');
const marketSettings = SLINK.core.market.normalizeSettings({ watches:[{ uid:'one', itemId:1, label:'Current Shops', maxPrice:90, marketEnabled:true, bazaarEnabled:true }] });
const marketDeals = SLINK.core.market.opportunityRows({ catalog:{ items:marketCatalog }, results:{ one:{ market:{ listings:[{ price:80, quantity:3 }] }, bazaar:{ listings:[{ sellerId:44, sellerName:'Seller', price:85, quantity:2, href:'https://www.torn.com/bazaar.php?userId=44&itemId=1&price=85&slinkHighlight=1#/' }] } } } }, marketSettings);
assert(marketDeals.length === 2 && marketDeals.every(row => row.shareText.includes('shop sell $125')), 'Market/Bazaar deal copy omitted the Torn shop sell price.');
assert(marketDeals.find(row => row.source === 'Item Market')?.href.includes('page.php?sid=ItemMarket'), 'Item Market deal uses an obsolete Torn route.');
const meritStats = SLINK.core.merits.numericPersonalStats({ personalstats:{ attacking:{ attacks:{ won:100 }, defends:{ won:44 }, escapes:{ player:27, foes:4 }, faction:{ respect:31_262 } }, crimes:{ offenses:{ total:10_100 } }, finishing_hits:{ pistols:125 } } });
const meritSnapshot = {
  medals:[{ id:1 }, { id:30 }], honors:[], merits:{ available:4 },
  catalogMedals:[
    { id:1, name:'Anti Social', description:'Win 50 attacks', type:{ id:'ATK', title:'Attacking' } },
    { id:2, name:'Happy Slapper', description:'Win 250 attacks', type:{ id:'ATK', title:'Attacking' } },
    { id:3, name:'Scar Maker', description:'Win 500 attacks', type:{ id:'ATK', title:'Attacking' } },
    { id:10, name:'Bouncer', description:'Successfully defended against 50 attacks', type:{ id:'ATK', title:'Attacking' } },
    { id:11, name:'Brick Wall', description:'Successfully defended against 250 attacks', type:{ id:'ATK', title:'Attacking' } },
    { id:20, name:'Close Escape', description:'Successfully escape from 50 foes', type:{ id:'ATK', title:'Attacking' } },
    { id:21, name:'Foo Smasher', description:'Have 50 enemies escape from you during an attack', type:{ id:'ATK', title:'Attacking' } },
    { id:30, name:'Troublemaker', description:'Commit a total of 100 criminal offenses', type:{ id:'CRM', title:'Crimes' } },
    { id:31, name:'Legendary Lawbreaker', description:'Commit a total of 10,000 criminal offenses', type:{ id:'CRM', title:'Crimes' } },
    { id:40, name:'Celebrity', description:'Reach the rank of Celebrity', type:{ id:'RNK', title:'Rank' } },
    { id:41, name:'Supreme', description:'Reach the rank of Supreme', type:{ id:'RNK', title:'Rank' } },
    { id:50, name:'Committed', description:'Be married for 1,000 days', type:{ id:'COM', title:'Commitment' } }
  ],
  catalogHonors:[],
  personalStats:meritStats,
  finishingHits:{ pistols:125 },
  profile:{ level:68, age:4200, daysMarried:100, factionDays:600, rank:'Outstanding', rankIndex:17 }
};
const meritView = SLINK.core.merits.buildView(meritSnapshot, { pinned:['medal:2'], refreshMinutes:15 });
const attackGoal = meritView.goals.find(goal => goal.name === 'Happy Slapper');
assert(attackGoal?.progress?.rows?.[0]?.current === 100 && attackGoal.progress.rows[0].target === 250, 'Attack medal progress did not use the matching Torn personal-stat counter.');
assert(attackGoal.laterMilestones.some(row => row.name === 'Scar Maker'), 'Later attack tiers were not collapsed under the next milestone.');
assert(meritView.goals.some(goal => goal.name === 'Bouncer'), 'Defend medals were incorrectly merged with attack medals.');
assert(meritView.goals.find(goal => goal.name === 'Bouncer')?.progress?.rows?.[0]?.current === 44, 'Defend progress did not use successful defends.');
assert(meritView.goals.some(goal => goal.name === 'Close Escape') && meritView.goals.some(goal => goal.name === 'Foo Smasher'), 'Player escapes and enemy escapes were incorrectly merged.');
assert(meritView.goals.find(goal => goal.name === 'Legendary Lawbreaker')?.progress?.rows?.[0]?.current === 10_100, 'Criminal-offense progress did not use Torn personal stats.');
assert(meritView.goals.find(goal => goal.name === 'Celebrity')?.progress?.rows?.[0]?.target === 18, 'Rank medals were not grouped or mapped to Torn rank progression.');
assert(meritView.goals.find(goal => goal.name === 'Committed')?.progress?.rows?.[0]?.current === 100, 'Marriage commitment did not use profile days married.');
assert(meritView.pinned.length === 1 && meritView.pinned[0].key === 'medal:2', 'Pinned Merit farm was not preserved.');
const adhdSettings = SLINK.core.adhd.defaultSettings();
assert(adhdSettings.openLinksInNewTab === false, 'Torn alert links must default to the current tab.');
assert(SLINK.core.adhd.normalizeSettings({ openLinksInNewTab:true }).openLinksInNewTab === true, 'New-tab preference was not normalized.');
const partialCity = SLINK.core.adhd.cityProgress({ cityItemsBought:575, cityItemsAtReset:500 }, adhdSettings);
assert(partialCity.bought === 75 && partialCity.remaining === 25 && !partialCity.complete, 'Shared city purchase progress was calculated incorrectly.');
const completeCity = SLINK.core.adhd.cityProgress({ cityItemsBought:600, cityItemsAtReset:500 }, adhdSettings);
assert(completeCity.bought === 100 && completeCity.complete, 'The shared 100-item city cap did not complete all city reminders.');
assert(!SLINK.core.adhd.buildAlerts({ fetchedAt:Date.now(), cityItemsBought:600, cityItemsAtReset:500, data:{} }, adhdSettings).some(alert => alert.id === 'cityItem'), 'A city reminder remained after the shared daily cap was met.');
const cityStockSettings = SLINK.core.adhd.normalizeSettings({ cityStockAlerts:{ 392:true } });
const cityStockSnapshot = { fetchedAt:Date.now(), cityItemsBought:575, cityItemsAtReset:500, data:{}, cityShops:{ cityshops:[{ name:"Big Al's Gun Shop", items:[{ id:392, price:200, stock:{ current:123, default:500 } }] }] } };
assert(SLINK.core.adhd.buildAlerts(cityStockSnapshot, cityStockSettings).some(alert => alert.id === 'cityStock:392'), 'Enabled city stock did not produce an alert below the shared cap.');
assert(SLINK.core.adhd.buildAlerts(cityStockSnapshot, cityStockSettings).find(alert => alert.id === 'cityStock:392')?.shareText.includes('<a href="https://www.torn.com/bigalgunshop.php">Big Al&#39;s Gun Shop</a>'), 'City stock chat text omitted its safe HTML shop link.');
assert(!SLINK.core.adhd.buildAlerts({ ...cityStockSnapshot, cityItemsBought:600 }, cityStockSettings).some(alert => alert.id.startsWith('cityStock:')), 'City stock alerts remained after the shared 100-item cap.');
const modifier = [{ effect:'Addiction', type:'addiction', value:-5 }];
const efficiencySnapshot = {
  fetchedAt:Date.now(), cityItemsBought:600, cityItemsAtReset:500,
  data:{
    cooldowns:{ drug:0, medical:0, booster:0 },
    missions:{ givers:[{ contracts:[{ status:'accepted', title:'One' }, { status:'Accepted', title:'Two' }, { status:'ACCEPTED', title:'Three' }] }] },
    refills:{ energy:{ available:true }, nerve:{ available:true } },
    stocks:[{ id:7, bonus:{ available:true, frequency:7 } }, { id:25, bonus:{ available:true, frequency:0 } }],
    battlestats:{ strength:{ modifiers:modifier }, defense:{ modifiers:modifier }, speed:{ modifiers:modifier }, dexterity:{ modifiers:modifier } }
  },
  stockCatalog:{ stocks:[{ id:7, name:'Collectible Industries', acronym:'COL', bonus:{ passive:false } }, { id:25, name:'West Side University', acronym:'WSU', bonus:{ passive:true } }] },
  cluster:{ crimes:{ crimes:{ skill:100, uniques:[] } }, subcrimes:{ subcrimes:[{ id:44, name:'Jewelry Store' }] }, status:{ shoplifting:[{ id:44, status:[{ title:'Cameras', disabled:true }, { title:'Guard', disabled:true }] }] } }
};
const efficiencyAlerts = SLINK.core.adhd.buildAlerts(efficiencySnapshot, adhdSettings);
const waitingRaceSnapshot = {
  fetchedAt:Date.now(),
  cityItemsBought:600,
  cityItemsAtReset:500,
  data:{ enlistedcars:[], races:[], profile:{ status:{ state:'Okay', description:'Waiting for a race', details:'' } } }
};
assert(!SLINK.core.adhd.buildAlerts(waitingRaceSnapshot, adhdSettings).some(alert => alert.id === 'raceOrFly'), 'Waiting for a race was treated as available to join another race.');
assert(SLINK.core.adhd.raceActive([{ status:'in_progress' }], {}), 'An in-progress race was not detected from race history.');
assert(efficiencyAlerts.find(alert => alert.id === 'missions')?.title.includes('cap reached'), 'Three accepted missions did not produce the mission-cap warning.');
assert(efficiencyAlerts.some(alert => alert.id === 'stockBenefits'), 'Ready API stock benefit did not produce an alert.');
assert(efficiencyAlerts.find(alert => alert.id === 'stockBenefits')?.detail.includes('Collectible Industries (COL)'), 'Collectible stock alert did not use its catalog name.');
assert(!efficiencyAlerts.find(alert => alert.id === 'stockBenefits')?.detail.includes('WSU'), 'Passive stock benefit was incorrectly treated as collectible.');
assert(efficiencyAlerts.some(alert => alert.id === 'playerAddiction'), 'Battle-stat addiction modifier did not produce an alert.');
assert(efficiencyAlerts.some(alert => alert.id === 'clusterRing'), 'Cluster Ring API status did not produce an alert.');
assert(efficiencyAlerts.find(alert => alert.id === 'drugCooldown')?.links.some(link => link[0] === 'Faction Armory'), 'Cooldown alert omitted the faction armory link.');
const soundOnly = SLINK.core.adhd.normalizeSettings({ enabled:{ drugCooldown:false }, soundEnabled:{ drugCooldown:true } });
assert(!SLINK.core.adhd.buildAlerts(efficiencySnapshot, soundOnly).some(alert => alert.id === 'drugCooldown'), 'A hidden alert remained visible.');
assert(SLINK.core.adhd.buildAlerts(efficiencySnapshot, soundOnly, Date.now(), { includeHidden:true }).some(alert => alert.id === 'drugCooldown'), 'A sound-only alert was unavailable to the sound notifier.');
assert(SLINK.core.war.makeWarId(46978, 46999, 1_777_000_000) === 'rw_46978_46999_1777000000', 'Second-based War identity was changed.');
assert(SLINK.core.war.makeWarId(46978, 46999, 1_777_000_000_000) === 'rw_46978_46999_1777000000', 'Millisecond-based War identity was not normalized.');
assert(SLINK.core.war.sortMembers([
  { id:2, name:'Hospital', activity:'Offline', statusState:'Hospital', statusUntil:Math.floor(Date.now() / 1000) + 60 },
  { id:1, name:'Ready', activity:'Online', statusState:'Okay' }
])[0].id === 1, 'Available War targets were not sorted before hospitalized targets.');
const warCallout = SLINK.core.war.factionCallout({
  id:9001, name:'War Target', activity:'Online', statusState:'Hospital',
  statusUntil:Math.floor(Date.now() / 1000) + 600, battleStatsEstimate:2500000, fairFight:1.75
});
assert(warCallout.includes('Estimated BS: 2.5M'), 'Faction-chat callout omitted the estimated battle stats.');
assert(warCallout.includes('TCT') && warCallout.includes('Status: Hospital / Online'), 'Faction-chat callout omitted current status or hospital release time.');

await SLINK.core.storage.set('test.value', { working: true });
assert((await SLINK.core.storage.get('test.value')).working, 'Extension storage adapter failed.');
assert(values.has('slink.test.value'), 'Storage key was not namespaced.');

SLINK.modules.register({
  id: 'test-module',
  requiredScopes: ['test.read'],
  matches: url => url.hostname === 'www.torn.com',
  async start() { return { started: true }; }
});

const denied = await SLINK.modules.startAll({
  url: new URL('https://www.torn.com/index.php'),
  permissions: { scopes: [] }
});
assert(denied.denied.length === 1, 'Module permission denial failed.');

const started = await SLINK.modules.startAll({
  url: new URL('https://www.torn.com/index.php'),
  permissions: { scopes: ['test.read'] }
});
assert(started.started.includes('test-module'), 'Permitted module did not start.');
await SLINK.modules.stopAll();

assert(
  SLINK.core.http.validateUrl('tornApi', 'https://api.torn.com/v2/user').hostname === 'api.torn.com',
  'Approved HTTP origin was rejected.'
);
let blocked = false;
try {
  SLINK.core.http.validateUrl('tornApi', 'https://example.com/steal');
} catch (error) {
  blocked = error.code === 'SLINK_ORIGIN_BLOCKED';
}
assert(blocked, 'Unapproved HTTP origin was not blocked.');

const successfulFetch = context.fetch;
context.fetch = async () => ({
  ok:false,
  status:500,
  text:async () => JSON.stringify({
    error:'Authentication failed.',
    detail:'Permission lookup failed.'
  })
});
let diagnosticError = '';
try {
  await SLINK.core.http.requestJson(
    'slinkWorker',
    'https://slinkyleveling.richard-johnson554.workers.dev/api/auth'
  );
} catch (error) {
  diagnosticError = String(error.message);
}
context.fetch = successfulFetch;
assert(
  diagnosticError.includes('Permission lookup failed.'),
  'Safe Worker diagnostic detail was hidden from the extension.'
);

const workerProbe = await SLINK.core.workerClient.probe({ deep: true });
assert(workerProbe.connected, 'Required SLINK Worker probe did not connect.');
assert(workerProbe.database === 'connected', 'Deep SLINK Worker health was not normalized.');

await SLINK.core.tornApiLimiter.reserve({ limit: 1, wait: false });
let limited = false;
try {
  await SLINK.core.tornApiLimiter.reserve({ limit: 1, wait: false });
} catch (error) {
  limited = error.code === 'SLINK_TORN_API_LIMIT';
}
assert(limited, 'Torn API limiter did not enforce its ledger.');

const router = SLINK.core.messaging.createRouter({
  async echo(payload) { return payload; }
});
const routed = await new Promise(resolve => {
  const keptOpen = router(
    { channel: 'slink', requestId: 4, type: 'echo', payload: { value: 7 } },
    {},
    resolve
  );
  assert(keptOpen === true, 'Async message route did not keep the channel open.');
});
assert(routed.ok && routed.data.value === 7, 'Message router returned the wrong response.');

delete context.chrome.runtime.id;
const staleResult = await Promise.race([
  SLINK.core.messaging.send('stale').then(() => 'resolved', () => 'rejected'),
  new Promise(resolve => setTimeout(() => resolve('suspended'), 20))
]);
assert(staleResult === 'suspended', 'An obsolete extension page rejected instead of becoming quietly inactive.');

console.log('Core storage, required hosts, scopes, modules, HTTP guard, limiter, and messaging checks passed.');

