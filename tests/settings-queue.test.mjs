import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const read = name => fs.readFileSync(new URL('../'+name,import.meta.url),'utf8');
const records=new Map();let fail=false;
const api={core:{storage:{
 get:async(key,fallback)=>structuredClone(records.get(key)??fallback),
 set:async(key,value)=>{await new Promise(resolve=>setImmediate(resolve));if(fail){fail=false;throw Error('injected storage failure');}records.set(key,structuredClone(value));return value;}
}},define(group,key,value){(this[group]??={})[key]=value;}};
const context=vm.createContext({SLINK_EXTENSION:api,console,URL,structuredClone});
vm.runInContext(read('src/core/adhd.js'),context);
// Isolate mutation semantics from unrelated public-status network/permission dependencies.
// The actual normalizer and every mutation function are unchanged.
vm.runInContext(read('src/background/adhd-service.js').replaceAll('return publicStatus(false);','return settings();'),context);
const alerts=api.services.adhd.routes;
await Promise.all([
 alerts['adhd.settings.save']({enabled:{medicalCooldown:false}}),
 alerts['adhd.settings.save']({enabled:{boosterCooldown:false}}),
 alerts['adhd.alert.snooze']({id:'medicalCooldown',durationMs:300_000}),
 alerts['adhd.city.acknowledge'](),
 alerts['adhd.reminder.control']({action:'timer-start'})
]);
let saved=records.get('adhd.settings.v1');
assert.equal(saved.enabled.medicalCooldown,false);assert.equal(saved.enabled.boosterCooldown,false);
assert.ok(saved.snoozedUntil.medicalCooldown>Date.now());assert.ok(saved.cityDoneDay);assert.ok(saved.timer24EndsAt>Date.now());
fail=true;await assert.rejects(()=>alerts['adhd.settings.save']({medicalThresholdHours:2}),/injected storage failure/);
await alerts['adhd.settings.save']({medicalThresholdHours:4});
assert.equal(records.get('adhd.settings.v1').medicalThresholdHours,4);
assert.equal(records.get('adhd.settings.v1').enabled.medicalCooldown,false);
vm.runInContext(read('src/background/mugging-service.js'),context);
const save=api.services.mugging.routes['mugging.settings.save'];
records.set('mugging.settings.v1',{enabled:false,minFairFight:1,maxFairFight:3,limit:50,unknownFutureSetting:'retain'});
await Promise.all([save({enabled:true}),save({minFairFight:2}),save({limit:25})]);
saved=records.get('mugging.settings.v1');
assert.equal(saved.enabled,true);assert.equal(saved.minFairFight,2);assert.equal(saved.limit,25);assert.equal(saved.unknownFutureSetting,'retain');
fail=true;await assert.rejects(()=>save({limit:10}),/injected storage failure/);
await save({maxFairFight:2.9});assert.equal(records.get('mugging.settings.v1').limit,25);assert.equal(records.get('mugging.settings.v1').maxFairFight,2.9);
for(const name of ['src/modules/mugging.js','src/dashboard/dashboard.js'])assert.doesNotMatch(read(name),/storage\.set\((?:SETTINGS_KEY|['"]mugging\.settings\.v1)/,'Mugging consumers must patch through the background owner.');
vm.runInContext(read('src/core/bounties.js'),context);
let bountyCacheReads=0;
api.services.playerIntelligence={cacheMap:async()=>{bountyCacheReads++;return {};}};
vm.runInContext(read('src/background/bounties-service.js'),context);
const saveBounties=api.services.bounties.routes['bounties.settings.save'];
records.set('bounties.settings.v1',{enabled:false,minFF:1,maxFF:3,tornKey:'keep-torn',ffKey:'keep-ff',unknownFutureSetting:'retain'});
await Promise.all([saveBounties({enabled:true}),saveBounties({minFF:2}),saveBounties({maxBattleStats:123456})]);
saved=records.get('bounties.settings.v1');
assert.equal(saved.enabled,true);assert.equal(saved.minFF,2);assert.equal(saved.maxBattleStats,123456);
assert.equal(saved.unknownFutureSetting,'retain');
const publicBounty=await saveBounties({tornKey:'',ffKey:'',tornCallsPerMinute:999});
assert.equal(records.get('bounties.settings.v1').tornKey,'keep-torn');
assert.equal(records.get('bounties.settings.v1').ffKey,'keep-ff');
assert.equal(publicBounty.settings.tornCallsPerMinute,20,'Acknowledge normalized values');
assert.equal(publicBounty.settings.tornKey,undefined);assert.equal(publicBounty.settings.ffKey,undefined);
assert(!JSON.stringify(publicBounty).includes('keep-torn'));assert(!JSON.stringify(publicBounty).includes('keep-ff'));
fail=true;await assert.rejects(()=>saveBounties({minFF:1.5}),/injected storage failure/);
await saveBounties({maxFF:2.9});
assert.equal(records.get('bounties.settings.v1').minFF,2,'Rejected write did not change committed settings');
assert.equal(records.get('bounties.settings.v1').maxFF,2.9,'A failed write must not poison the next queued save');
await saveBounties({clearFfKey:true});
assert.equal(records.get('bounties.settings.v1').ffKey,'');
assert.equal(records.get('bounties.settings.v1').tornKey,'keep-torn');
const preservedScan={targets:[{id:123}],nextUrl:'synthetic-next-page',completed:false,scannedRows:50};
records.set('bounties.runtime.v1',structuredClone(preservedScan));
const beforePreferenceRead=bountyCacheReads;
await saveBounties({minimumReward:100000,scanFullList:true,deferScanRestart:true});
assert.deepEqual(records.get('bounties.runtime.v1'),preservedScan,'Preference autosave must not restart or discard the in-progress scan');
assert.equal(records.get('bounties.settings.v1').deferScanRestart,undefined,'Save transport flags are not user settings');
assert.equal(bountyCacheReads,beforePreferenceRead,'Autosave acknowledgements must not read the full player cache');
vm.runInContext(read('src/core/company.js'),context);
vm.runInContext(read('src/background/company-service.js'),context);
const saveCompany=api.services.company.routes['company.settings.save'];
records.set('company.settings.v1',{enabled:false,addictionThreshold:10,directorThreshold:10,refreshMinutes:30,unknownFutureSetting:'retain'});
records.set('company.runtime.v1',{snapshot:{company:{name:'Keep cached company'}}});
const companyRuntime=structuredClone(records.get('company.runtime.v1'));
await Promise.all([saveCompany({settings:{addictionThreshold:12}}),saveCompany({settings:{directorThreshold:25}})]);
saved=records.get('company.settings.v1');
assert.equal(saved.addictionThreshold,12);assert.equal(saved.directorThreshold,25);
assert.equal(saved.enabled,false);assert.equal(saved.refreshMinutes,30);assert.equal(saved.unknownFutureSetting,'retain');
fail=true;await assert.rejects(()=>saveCompany({settings:{addictionThreshold:18}}),/injected storage failure/);
const companyAck=await saveCompany({settings:{directorThreshold:999}});
assert.equal(companyAck.settings.directorThreshold,100);assert.equal(companyAck.settings.addictionThreshold,12);
assert.deepEqual(records.get('company.runtime.v1'),companyRuntime,'Company preference saves must not refresh or replace the cached company');
assert.deepEqual(Object.keys(companyAck),['settings'],'Lean acknowledgement must not need permissions, roster, API keys or network dependencies');
console.log('Settings queues: concurrent disjoint edits, failed writes/recovery, preserved unknown settings, Company lean acknowledgements, and client patch routing passed.');
