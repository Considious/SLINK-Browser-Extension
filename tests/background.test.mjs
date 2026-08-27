import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(testDirectory, '..');
const workerDirectory = path.join(root, 'src', 'background');
const values = new Map();
const alarms = new Map();
const claimRequestBodies = [];
let observationRequests = 0;
let claimScheduleBucket = 300;
let tornStatusState = 'Okay';
let contributionActive = false;
let warStatusSubmissions = 0;
let warAttackSubmissions = 0;
let warStoredLogReads = 0;
let sharedWarMode = 'war';
let sharedInsideHitCap = 0;
let warClaims = [];
let assignedWarStart = 0;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function event() {
  const listeners = [];
  return {
    addListener(listener) { listeners.push(listener); },
    fire(...args) { return listeners.map(listener => listener(...args)); },
    listeners
  };
}

const onMessage = event();
const onInstalled = event();
const onStartup = event();
const onAlarm = event();

const chrome = {
  alarms: {
    async create(name, details) { alarms.set(name, { name, ...details }); },
    async get(name) { return alarms.get(name); },
    onAlarm
  },
  permissions: {
    async contains({ origins }) {
      return origins.every(origin => [
        'https://api.torn.com/*',
        'https://ffscouter.com/*',
        'https://slinkyleveling.richard-johnson554.workers.dev/*',
        'https://slinkcontributionworker.richard-johnson554.workers.dev/*',
        'https://slinkwarworker.richard-johnson554.workers.dev/*'
      ].includes(origin));
    }
  },
  runtime: {
    getManifest() { return { version: '0.11.1' }; },
    onInstalled,
    onMessage,
    onStartup
  },
  storage: {
    local: {
      async get(key) {
        if (typeof key === 'string') return values.has(key) ? { [key]: values.get(key) } : {};
        return Object.fromEntries(values);
      },
      async remove(key) {
        for (const item of Array.isArray(key) ? key : [key]) values.delete(item);
      },
      async set(entries) {
        for (const [key, value] of Object.entries(entries)) values.set(key, value);
      }
    }
  }
};

let context;
context = vm.createContext({
  chrome,
  console,
  fetch: async (input, options = {}) => {
    const url = new URL(String(input));
    let body = { ok: true };
    if (url.hostname === 'slinkyleveling.richard-johnson554.workers.dev') {
      if (url.pathname === '/') body = { ok: true, service: 'SLINK Leveling API', version: 'test-worker' };
      if (url.pathname === '/api/health') body = { ok: true, version: 'test-worker', database: 'connected', consent_database: 'connected', permissions_database: 'connected' };
      if (url.pathname === '/api/terms') body = {
        ok: true,
        version: 'test-terms',
        effective_at: '2026-08-14',
        document_url: 'https://example.test/terms',
        document_sha256: 'terms-hash',
        disclosure_version: 'test-disclosure',
        disclosure_sha256: 'disclosure-hash',
        leveling_service_summary: 'Test disclosure.'
      };
      if (url.pathname === '/api/auth') body = {
        ok: true,
        session_token: 'signed-test-session',
        expires_at: new Date(Date.now() + 3_600_000).toISOString(),
        user_id: 3853023,
        roles: ['admin'],
        scopes: ['admin.*', 'slink.level']
      };
      if (url.pathname === '/api/recommendations') body = {
        ok: true,
        version: 'test-worker',
        collector: true,
        collector_expires_at: Date.now() + 300_000,
        targets: [{ id: 123, name: 'Target', level: 50, status: 'Okay', total_stats: 1000 }]
      };
      if (url.pathname === '/api/checks/claim') {
        claimRequestBodies.push(JSON.parse(String(options.body || '{}')));
        body = {
        ok: true,
        collector: true,
        coordination: 'client_rendezvous_hash',
        schedule: 'client_deterministic_time_bucket',
        schedule_bucket: claimScheduleBucket,
        batch_id: `extension-session:${claimScheduleBucket}`,
        collector_user_id: 3853023,
        collector_session_id: 'extension-session',
        collector_roster: [{ user_id: 3853023, session_id: 'extension-session' }],
        targets: [{
          id: 123,
          name: 'Target',
          level: 50,
          total_stats: 1000,
          has_status: 1,
          previous_status: 'Okay',
          previous_status_until: 0,
          previous_last_checked_at: Date.now(),
          next_check_at: 0,
          competition_score: 0,
          competition_tier: 'Prime',
          hiding_out: 0,
          permanent_federal: 0,
          activity_last_seen_at: 0,
          recommendation_leased: 0
        }],
          checks: []
        };
      }
      if (url.pathname === '/api/targets') body = { ok: true, targets: [{ id: 123 }] };
      if (url.pathname === '/api/observations') {
        observationRequests++;
        body = {
          ok: true,
          accepted_count: 1,
          rejected_count: 0,
          accepted: [{ target_id: 123 }],
          rejected: []
        };
      }
    } else if (url.hostname === 'slinkcontributionworker.richard-johnson554.workers.dev') {
      if (url.pathname === '/api/health') body = { ok:true, version:'test-contribution', database:'connected' };
      if (url.pathname === '/api/terms') body = {
        ok:true, version:'2026-08-23', document_url:'https://example.test/donation-terms', document_sha256:'terms-hash',
        disclosure_version:'2026-08-23', disclosure_sha256:'summary-hash', summary:'Encrypted offline donation test.'
      };
      if (url.pathname === '/api/donations' && options.method === 'POST') {
        contributionActive = true;
        body = { ok:true, donated:true, user_id:3853023, access_type:'Public Only', status:'active', terms_version:'2026-08-23', donated_at:new Date().toISOString(), management_token:'management-secret' };
      } else if (url.pathname === '/api/donations' && options.method === 'DELETE') {
        contributionActive = false;
        body = { ok:true, revoked:true, user_id:3853023 };
      } else if (url.pathname === '/api/donations') {
        body = { ok:true, donation:{ user_id:3853023, access_type:'Public Only', status:contributionActive ? 'active' : 'revoked', active:contributionActive } };
      }
    } else if (url.hostname === 'slinkwarworker.richard-johnson554.workers.dev') {
      if (url.pathname === '/api/health') body = { ok:true, version:'test-war', database:'connected', coordinator:'configured', session_secret:'configured' };
      if (url.pathname === '/api/terms') body = { ok:true, terms:{ version:'2026-08-24', sha256:'72a933d69ec99cabeb92b426208e9d0c47e90acaf960818e0b4da38f3f2f5b0a', url:'https://example.test/terms', summary:'War disclosure.' } };
      if (url.pathname === '/api/themes') body = { ok:true, source:'test-worker', catalog:{ schemaVersion:1, revision:'test.remote.1', themes:[
        { id:'slink-dark', label:'SLINK Dark', description:'Free fallback.', scope:null, ornament:'none', swatch:['#112233','#224466','#336699'], tokens:{ '--slink-bg':'#112233' } },
        { id:'slinky-pursuit', label:'Slinky Pursuit', description:'Pursuit.', scope:'slink.theme.pursuit', ornament:'coil', swatch:['#111111','#ff0000','#0000ff'], tokens:{ '--slink-accent':'#ff0000' } },
        { id:'slinky-underglow', label:'Slinky Underglow', description:'Underglow.', scope:'slink.theme.underglow', ornament:'coil', swatch:['#111111','#9900ff','#00ff66'], tokens:{ '--slink-accent':'#9900ff' } },
        { id:'slinky-black-chrome', label:'Slinky Black Chrome', description:'Chrome.', scope:'slink.theme.black-chrome', ornament:'coil', swatch:['#111111','#777777','#eeeeee'], tokens:{ '--slink-accent':'#777777' } }
      ] } };
      if (url.pathname === '/api/auth') body = { ok:true, session_token:'signed-war-session', expires_at:new Date(Date.now() + 3_600_000).toISOString(), user_id:3853023, user_name:'Considious', faction_id:46978, roles:['admin'], scopes:['admin.*','slink.war','slink.war.faction'] };
      if (url.pathname === '/api/admin/scopes') body = { ok:true, scopes:[{ scope:'slink.level', category:'Products', title:'SLINK Leveling' }, { scope:'slink.war', category:'Products', title:'SLINK War' }, { scope:'slink.war.officer', category:'War permissions', title:'SLINK War Officer' }, { scope:'slink.theme.underglow', category:'Themes', title:'Slinky Underglow' }] };
      if (/^\/api\/admin\/users\/\d+\/permissions$/.test(url.pathname)) {
        const selected = options.method === 'POST' ? new Set(JSON.parse(options.body || '{}').scopes || []) : new Set(['slink.level']);
        body = { ok:true, user_id:Number(url.pathname.split('/')[4]), scopes:[
          { scope:'slink.level', category:'Products', title:'SLINK Leveling', description:'Leveling access', active:selected.has('slink.level'), status:selected.has('slink.level') ? 'active' : 'not_granted', expires_at:selected.has('slink.level') ? Date.now() + 86_400_000 : null },
          { scope:'slink.war', category:'Products', title:'SLINK War', description:'War access', active:selected.has('slink.war'), status:selected.has('slink.war') ? 'active' : 'not_granted', expires_at:selected.has('slink.war') ? Date.now() + 86_400_000 : null },
          { scope:'slink.theme.underglow', category:'Themes', title:'Slinky Underglow', description:'Purple and green theme', active:selected.has('slink.theme.underglow'), status:selected.has('slink.theme.underglow') ? 'active' : 'not_granted', expires_at:selected.has('slink.theme.underglow') ? Date.now() + 86_400_000 : null }
        ] };
      }
      if (url.pathname.endsWith('/heartbeat')) body = { ok:true, collectStatus:true, collectAttacks:true, statusCollectorAvailable:true, attackCollectorAvailable:true };
      if (url.pathname.endsWith('/status')) {
        warStatusSubmissions++;
        body = { ok:true, accepted:1, observedAt:Date.now() };
      }
      if (url.pathname.endsWith('/attacks')) {
        warAttackSubmissions++;
        body = { ok:true, accepted:1, retals:1, aggregates:0 };
      }
      if (url.pathname.endsWith('/snapshot')) body = {
        ok:true,
        observedAt:Date.now(),
        members:[{ id:9001, name:'War Target', level:55, activity:'Offline', statusState:'Okay' }],
        retals:[{ attackId:'retal-1', attackerId:9001, attackerName:'War Target', defenderId:3853023, defenderName:'Considious', expiresAt:Math.floor(Date.now() / 1000) + 240 }],
        config:{ mode:sharedWarMode, idleMinutes:5, insideHitCap:sharedInsideHitCap, updatedBy:3853023, updatedAt:Date.now() },
        claims:warClaims,
        collectors:{ status:true, attacks:true }
      };
      if (url.pathname.endsWith('/config')) {
        const request = JSON.parse(String(options.body || '{}'));
        sharedWarMode = request.mode === 'termed' ? 'termed' : 'war';
        sharedInsideHitCap = Number(request.insideHitCap) || 0;
        body = { ok:true, config:{ mode:sharedWarMode, idleMinutes:Number(request.idleMinutes) || 0, insideHitCap:sharedInsideHitCap, updatedBy:3853023, updatedAt:Date.now() } };
      }
      if (url.pathname.endsWith('/claims')) {
        const request = JSON.parse(String(options.body || '{}'));
        if (request.operation === 'release') warClaims = warClaims.filter(claim => claim.targetId !== Number(request.targetId));
        else warClaims = [{ targetId:Number(request.targetId), targetName:request.targetName, claimedById:Number(request.assigneeId) || 3853023, claimedByName:request.assigneeName || 'Considious', assignedById:3853023, assignedByName:'Considious', claimedAt:Date.now(), expiresAt:Date.now() + 1_800_000 }];
        body = { ok:true, claims:warClaims };
      }
      if (url.pathname.endsWith('/logs')) body = {
        ok:true,
        pending:[{ attacker_id:3853023, attacker_name:'Considious', defender_id:9001, defender_name:'War Target', outcome:'loss', event_count:1, first_seen_at:Date.now(), last_seen_at:Date.now() }],
        stored:[],
        storedAvailable:false,
        storageWarning:'Historical War log storage is not configured. Live targets and retals remain available.'
      };
      if (url.pathname.endsWith('/logs') && url.searchParams.get('include_stored') !== '0') warStoredLogReads++;
    } else if (url.hostname === 'api.torn.com') {
      if (url.pathname === '/v2/faction/46978/rankedwars') body = {
        rankedwars:assignedWarStart ? [{
          id:'scheduled-test',
          war:{ start:Math.floor(assignedWarStart / 1000), end:0 },
          factions:{ 46978:{ name:'Slinkys' }, 46999:{ name:'Future Opponent' } }
        }] : []
      };
      else if (url.pathname === '/v2/faction/46999/members') body = {
        members:[{ id:9001, name:'War Target', level:55, last_action:{ status:'Offline', timestamp:Math.floor(Date.now() / 1000) - 300 }, status:{ state:'Okay', description:'Okay', until:0 } }]
      };
      else if (url.pathname === '/v2/faction/attacks') body = {
        attacks:[{ id:'attack-1', ended:Math.floor(Date.now() / 1000), attacker:{ id:9001, name:'War Target', faction:{ id:46999 } }, defender:{ id:3853023, name:'Considious', faction:{ id:46978 } }, result:'Hospitalized' }]
      };
      else if (url.pathname === '/v2/user/attacks') body = {
        attacks:[{ id:'my-mug-1', ended:Math.floor(Date.now() / 1000), attacker:{ id:3853023, faction:{ id:46978 } }, defender:{ id:9001, faction:{ id:46999 } }, result:'Mugged', is_ranked_war:true, money_mugged:1250000 }]
      };
      else if (url.pathname === '/v2/faction/chain') body = { chain:{ id:444, current:25, max:50, timeout:75 } };
      else if (url.pathname === '/v2/faction/444/chainreport' || url.pathname === '/v2/faction/chainreport') body = { chainreport:{ id:444, hits:25, respect:31.5 } };
      else if (url.pathname.endsWith('/battlestats')) body = {
        battlestats: { strength: 100, defense: 100, speed: 100, dexterity: 100, total: 400 }
      };
      else if (url.pathname.endsWith('/snapshot')) body = 'id,name\n123,Target\n';
      else body = {
        profile: {
          status: {
            state: tornStatusState,
            description: tornStatusState,
            until: tornStatusState === 'Hospital' ? Math.floor(Date.now() / 1000) + 600 : 0
          }
        }
      };
    } else if (url.hostname === 'ffscouter.com') {
      body = [
        { player_id:123, fair_fight:2, bs_estimate:1000, source:'FFScouter' },
        { player_id:9001, fair_fight:1.75, bs_estimate:2500000, source:'FFScouter' }
      ];
    }
    return {
      ok: true,
      status: 200,
      text: async () => typeof body === 'string' ? body : JSON.stringify(body),
      requestMethod: options.method || 'GET'
    };
  },
  setTimeout,
  clearTimeout,
  URL,
  URLSearchParams,
  importScripts(...relativePaths) {
    for (const relativePath of relativePaths) {
      const filename = path.resolve(workerDirectory, relativePath);
      vm.runInContext(fs.readFileSync(filename, 'utf8'), context, { filename });
    }
  }
});
context.globalThis = context;

const workerPath = path.join(workerDirectory, 'service-worker.js');
vm.runInContext(fs.readFileSync(workerPath, 'utf8'), context, { filename: workerPath });
await new Promise(resolve => setTimeout(resolve, 0));

assert(onMessage.listeners.length === 1, 'Background message router was not registered.');
assert(onInstalled.listeners.length === 1, 'Install listener was not registered.');
assert(onStartup.listeners.length === 1, 'Startup listener was not registered.');
assert(onAlarm.listeners.length === 1, 'Alarm listener was not registered.');
assert(values.get('slink.ui.pagePanelHidden') === false, 'Default page-panel state was not created.');
assert(values.get('slink.permissions.snapshot')?.scopes?.length === 0, 'Unauthenticated bootstrap must not invent server scopes.');
assert(alarms.has('slink.worker.connection'), 'Worker connection alarm was not created.');
assert(values.get('slink.worker.lastStatus')?.connected === true, 'Automatic Worker connection was not persisted.');
assert(values.get('slink.themes.catalog.v1')?.catalog?.revision === 'test.remote.1', 'Remote theme catalog was not cached locally.');

async function send(type, payload = {}, sender = { id: 'test' }) {
  return new Promise(resolve => {
    const keptOpen = onMessage.listeners[0](
      { channel: 'slink', requestId: 1, type, payload },
      sender,
      resolve
    );
    assert(keptOpen === true, `Route ${type} did not keep the response channel open.`);
  });
}

const status = await send('system.status');
assert(status.ok, 'System status route failed.');
assert(status.data.permissions.scopes.length === 0, 'System status invented an unauthenticated scope.');
assert(status.data.capabilities.tornApi.granted === true, 'Capability status did not report the granted mock host.');
assert(status.data.capabilities.ffscouter.granted === true, 'Required FFScouter capability was not granted.');
assert(status.data.capabilities.slinkWorker.granted === true, 'Required Worker capability was not granted.');
assert(status.data.capabilities.contributionWorker.granted === true, 'Required contribution capability was not granted.');
assert(status.data.capabilities.warWorker.granted === true, 'Required War capability was not granted.');
assert(status.data.worker.connected === true, 'System status did not report a real Worker connection.');
assert(status.data.leveling.terms.accepted === false, 'Fresh Leveling terms should require acceptance.');

const donated = await send('contribution.donate', { apiKey:'public-only-test-key', acceptTerms:true });
assert(donated.ok && donated.data.donation.active, 'Public Only donation route failed.');
assert(!JSON.stringify(donated.data).includes('public-only-test-key'), 'Donation response leaked the Torn key.');
assert(!JSON.stringify(donated.data).includes('management-secret'), 'Donation response leaked the management token.');
assert(values.get('slink.contribution.managementToken') === 'management-secret', 'Donation management token was not saved locally.');
const revoked = await send('contribution.revoke');
assert(revoked.ok && !revoked.data.configured, 'Donation revocation route failed.');
assert(!values.has('slink.contribution.managementToken'), 'Revocation did not remove the local management token.');

const injection = await send(
  'content.ready',
  { url: 'https://www.torn.com/index.php' },
  { id: 'test', tab: { id: 7, url: 'https://www.torn.com/index.php' } }
);
assert(injection.ok && injection.data.tabId === 7, 'Torn page injection was not recorded.');

const saved = await send('leveling.settings.save', {
  tornKey: 'torn-test-key',
  ffKey: 'ff-test-key',
  pollSeconds: 60,
  minFF: 1,
  maxFF: 3,
  apiContributionLimit: 60,
  acceptTerms: true
});
assert(saved.ok && saved.data.session.authenticated, 'Leveling settings did not authenticate.');
assert(saved.data.permissions.scopes.includes('admin.*'), 'Worker-issued admin scope was not persisted.');
assert(!JSON.stringify(saved.data).includes('torn-test-key'), 'Public Leveling state leaked the Torn API key.');
assert(!JSON.stringify(saved.data).includes('signed-test-session'), 'Public Leveling state leaked the Worker session token.');

const prepared = await send('leveling.cycle.prepare');
assert(prepared.ok && prepared.data.status.runtime.targets.length === 1, 'Leveling cycle did not load recommendations.');
assert(prepared.data.checks.length === 1, 'Leveling cycle did not preserve assigned checks.');
assert(prepared.data.status.runtime.targets[0].fair_fight === 2, 'FFScouter result was not applied locally.');
assert(claimRequestBodies[0]?.scheduling_mode === 'client_v1', 'Client scheduling protocol was not requested.');

const checked = await send('leveling.check', prepared.data.checks[0]);
assert(checked.ok && checked.data.target_id === 123, 'Assigned Torn check failed.');
assert(checked.data.completed_locally === true, 'Stable Okay result was not completed locally.');
const submitted = await send('leveling.observations.submit', { observations: [checked.data] });
assert(submitted.ok && submitted.data.runtime.pendingChecks === 0, 'Local completion did not clear pending work.');
assert(observationRequests === 0, 'Stable Okay completion contacted the Worker observation route.');

claimScheduleBucket = 303;
tornStatusState = 'Hospital';
const changedPrepared = await send('leveling.cycle.prepare');
assert(changedPrepared.ok && changedPrepared.data.checks.length === 1, 'Changed-status test was not scheduled.');
const changedCheck = await send('leveling.check', changedPrepared.data.checks[0]);
assert(changedCheck.ok && changedCheck.data.completed_locally !== true, 'Changed status was incorrectly completed locally.');
const changedSubmitted = await send('leveling.observations.submit', { observations: [changedCheck.data] });
assert(changedSubmitted.ok && observationRequests === 1, 'Changed status was not reported to the Worker.');

const zeroContribution = await send('leveling.settings.save', { apiContributionLimit: 0 });
assert(zeroContribution.ok, 'Admin zero-contribution setting failed.');
assert(zeroContribution.data.settings.apiContributionLimit === 0, 'Admin zero-contribution override was not saved.');
const zeroPrepared = await send('leveling.cycle.prepare');
assert(zeroPrepared.ok && zeroPrepared.data.checks.length === 0, 'Admin zero-contribution mode still scheduled Torn checks.');

const warSaved = await send('war.settings.save', {
  tornKey:'war-test-key',
  ffKey:'ff-test-key',
  displayMode:'hybrid',
  warMode:'war',
  idleMinutes:5,
  acceptTerms:true
});
assert(warSaved.ok && warSaved.data.session.authenticated, 'War settings did not authenticate.');
assert(warSaved.data.session.factionCapable, 'Faction attack capability was not persisted.');
assert(warSaved.data.permissions.scopes.includes('slink.war'), 'War product scope was not persisted.');
assert(!JSON.stringify(warSaved.data).includes('war-test-key'), 'Public War state leaked the Torn API key.');

assignedWarStart = Date.now() + 60 * 60 * 1000;
const scheduledCycle = await send('war.cycle.prepare', { forceOpponentRefresh:true });
assert(scheduledCycle.ok && scheduledCycle.data.activeWar.phase === 'scheduled', 'Assigned future War was not discovered as scheduled.');
assert(scheduledCycle.ok && scheduledCycle.data.runtime.snapshot.members.length === 1, 'Assigned War did not load the enemy roster for med-out claims.');
assert(scheduledCycle.data.runtime.snapshot.retals.length === 0, 'Retals were enabled before the assigned War started.');
assert(warStatusSubmissions === 0 && warAttackSubmissions === 0, 'Assigned War started live collection before the pre-war window.');
const scheduledConfig = await send('war.config.save', { mode:'termed', idleMinutes:10, insideHitCap:25 });
assert(scheduledConfig.ok && scheduledConfig.data.sharedConfig.mode === 'termed', 'Officer settings were unavailable for an assigned War.');
assert(scheduledConfig.data.sharedConfig.insideHitCap === 25, 'Officer inside-hit cap was not saved faction-wide.');
const scheduledClaim = await send('war.claims.update', { operation:'claim', targetId:9001, targetName:'War Target' });
assert(scheduledClaim.ok && scheduledClaim.data.runtime.snapshot.claims[0].claimedByName === 'Considious', 'Med-out claims were unavailable for an assigned War.');
await send('war.claims.update', { operation:'release', targetId:9001, targetName:'War Target' });
const assignedClaim = await send('war.claims.update', { operation:'claim', targetId:9001, targetName:'War Target', assigneeId:1234567, assigneeName:'Assigned Member' });
assert(assignedClaim.ok && assignedClaim.data.runtime.snapshot.claims[0].claimedById === 1234567, 'Officer could not assign a med-out partner to another member.');
await send('war.claims.update', { operation:'release', targetId:9001, targetName:'War Target' });

const detectedWar = await send('war.active.detect', {
  opponentFactionId:46999,
  opponentName:'Test Opponent',
  rankedWarId:'active-test',
  startedAt:1_777_000_000
});
assert(detectedWar.ok && detectedWar.data.activeWar.warId === 'rw_46978_46999_1777000000', 'Active War identity was not stable.');
const warCycle = await send('war.cycle.prepare');
assert(warCycle.ok && warCycle.data.runtime.snapshot.members.length === 1, 'War cycle did not load the shared target snapshot.');
assert(warCycle.data.runtime.snapshot.retals.length === 1, 'War cycle did not load active retals.');
assert(warCycle.data.runtime.snapshot.members[0].battleStatsEstimate === 2500000, 'War target did not retain the FFScouter battle-stat estimate.');
assert(warCycle.data.runtime.logs[0].event_count === 1, 'War cycle did not load aggregate logs.');
assert(warCycle.data.runtime.logsWarning.includes('Live targets and retals remain available'), 'Missing historical storage did not degrade to a live-data warning.');
assert(warCycle.data.runtime.panelStats.mugTotal === 1250000 && warCycle.data.runtime.panelStats.mugAverage === 1250000, 'Mug totals were not calculated from personal attacks.');
assert(warStatusSubmissions === 1, 'Elected public status collector did not submit once.');
assert(warAttackSubmissions === 1, 'Elected faction collector did not submit attacks once.');
const configuredWar = await send('war.config.save', { mode:'termed', idleMinutes:10, insideHitCap:25 });
assert(configuredWar.ok && configuredWar.data.sharedConfig.mode === 'termed', 'Officer War mode was not saved faction-wide.');
const claimedWar = await send('war.claims.update', { operation:'claim', targetId:9001, targetName:'War Target' });
assert(claimedWar.ok && claimedWar.data.runtime.snapshot.claims[0].claimedByName === 'Considious', 'Med-out claim was not shared through the War coordinator.');
const copiedReport = await send('war.chain.report');
assert(copiedReport.ok && copiedReport.data.text.includes('War hits: 1/25') && copiedReport.data.text.includes('$1,250,000'), 'On-demand chain report omitted the shared cap or mug totals.');
const secondWarCycle = await send('war.cycle.prepare');
assert(secondWarCycle.ok, 'Second War refresh failed.');
assert(warStoredLogReads === 1, 'War panels reread persisted D1 logs before the ten-minute cache expired.');
assert(values.get('slink.permissions.snapshot')?.scopes.includes('slink.level'), 'War authentication discarded the Leveling scope.');
assert(values.get('slink.permissions.snapshot')?.scopes.includes('slink.war'), 'Combined permissions omitted the War scope.');
const adminPermissions = await send('war.admin.permissions.get', { userId:1234567 });
assert(adminPermissions.ok && adminPermissions.data.user_id === 1234567, 'Admin permission lookup failed.');
const updatedPermissions = await send('war.admin.permissions.save', { userId:1234567, scopes:['slink.level','slink.war','slink.theme.underglow'], hours:24, note:'Test grant' });
assert(updatedPermissions.ok && updatedPermissions.data.scopes.find(scope => scope.scope === 'slink.war').active, 'Admin permission update failed.');
assert(updatedPermissions.data.scopes.find(scope => scope.scope === 'slink.theme.underglow').active, 'Theme permission update failed.');

const leader = await send('leveling.leader.claim', {}, { id: 'test', tab: { id: 7 } });
assert(leader.ok && leader.data.leader, 'Torn tab did not acquire the local Leveling leader lease.');

const diagnostic = await send('diagnostics.run');
assert(diagnostic.ok && diagnostic.data.source === 'manual', 'Manual diagnostic route failed.');
assert(values.get('slink.diagnostics.lastRun')?.source === 'manual', 'Manual diagnostic result was not persisted.');
assert(diagnostic.data.worker.database === 'connected', 'Diagnostic did not include deep Worker health.');
assert(diagnostic.data.pageInjection.tabId === 7, 'Diagnostic did not include Torn injection state.');
assert(diagnostic.data.leveling.configured === true, 'Diagnostic did not include Leveling configuration state.');
assert(diagnostic.data.war.authenticated === true, 'Diagnostic did not include War authentication state.');

values.delete('slink.worker.lastStatus');
onAlarm.fire({ name: 'slink.worker.connection' });
await new Promise(resolve => setTimeout(resolve, 0));
assert(values.get('slink.worker.lastStatus')?.connected === true, 'Alarm connection status was not persisted.');

console.log('Background startup, required capabilities, Leveling and War auth/collection, routes, alarms, and diagnostics passed.');

