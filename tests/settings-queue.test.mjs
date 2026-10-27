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
vm.runInContext(read('src/core/racing.js'),context);
vm.runInContext(read('src/background/racing-service.js'),context);
const garage=api.services.racing;
const [carA,carB]=api.core.racing.RECOMMENDED_BUILDS;
const garageKey='racing.buildGuide.v1';
records.set(garageKey,{view:'all',futureOption:'keep',builds:{[carA.id]:{completed:false,customName:'Original',futureField:123},'future-build':{customName:'Do not delete'}}});
await Promise.all([garage.save({[carA.id+':name']:'New name'}),garage.save({[carA.id+':completed']:true}),garage.save({[carB.id+':name']:'Other car'})]);
saved=records.get(garageKey);
assert.equal(saved.builds[carA.id].customName,'New name');assert.equal(saved.builds[carA.id].completed,true);
assert.equal(saved.builds[carB.id].customName,'Other car');assert.equal(saved.futureOption,'keep');
assert.equal(saved.builds[carA.id].futureField,123);assert.equal(saved.builds['future-build'].customName,'Do not delete');
const beforeInvalid=structuredClone(saved);
await assert.rejects(()=>garage.save({[carA.id+':name']:'x'.repeat(23)}),/22 characters/);
await assert.rejects(()=>garage.save({[carA.id+':name']:'  '}),/22 characters/);
assert.deepEqual(records.get(garageKey),beforeInvalid);
fail=true;await assert.rejects(()=>garage.save({view:'needed'}),/injected storage failure/);
await garage.save({view:'completed'});assert.equal(records.get(garageKey).view,'completed');
const suggestion=api.core.racing.suggestNickname(carA.tracks).value;
const nameAck=await garage.save({[carA.id+':name']:' '+suggestion+' '});
assert.equal(nameAck.settings[carA.id+':name'],suggestion);assert.equal(records.get(garageKey).builds[carA.id].customName,'');
assert.equal((await garage.status()).state.builds[carA.id].completed,true);
assert.doesNotMatch(read('src/modules/racing.js'),/core\.storage\.set/,'Racing UI must use its mutation owner, not whole-state writes');
vm.runInContext(read('src/core/abroad-stocks.js'),context);
vm.runInContext(read('src/background/abroad-stocks-service.js'),context);
const saveAbroad=api.services.abroadStocks.routes['abroadStocks.settings.save'];
records.set('abroadStocks.settings.v1',{travelMethod:'airstrip',travelDefault:'airstrip',travelMethodExplicit:false,arrivalBufferMinutes:3,alertLeadMinutes:10,alertsEnabled:true,soundEnabled:false,landingRecommendationEnabled:true,tornIntelKey:'retain-legacy-secret',useDroqs:false,futureOption:'keep'});
await Promise.all([saveAbroad({settings:{alertsEnabled:false}}),saveAbroad({settings:{arrivalBufferMinutes:0}}),saveAbroad({settings:{alertLeadMinutes:0}})]);
saved=records.get('abroadStocks.settings.v1');
assert.equal(saved.alertsEnabled,false);assert.equal(saved.arrivalBufferMinutes,0);assert.equal(saved.alertLeadMinutes,0);
assert.equal(saved.travelMethodExplicit,false,'Changing unrelated reminders must not freeze automatic travel detection');
assert.equal(saved.travelMethod,'airstrip');assert.equal(saved.useDroqs,false);assert.equal(saved.futureOption,'keep');
assert.equal(saved.tornIntelKey,'retain-legacy-secret');
const publicAbroad=await saveAbroad({settings:{travelMethod:'standard'}});
assert.equal(publicAbroad.settings.travelMethod,'standard');assert.equal(publicAbroad.settings.travelMethodExplicit,true);
assert.equal(publicAbroad.settings.tornIntelKey,undefined);assert(!JSON.stringify(publicAbroad).includes('retain-legacy-secret'));
fail=true;await assert.rejects(()=>saveAbroad({settings:{soundEnabled:true}}),/injected storage failure/);
await saveAbroad({settings:{alertLeadMinutes:999}});
assert.equal(records.get('abroadStocks.settings.v1').alertLeadMinutes,180);assert.equal(records.get('abroadStocks.settings.v1').soundEnabled,false);
assert.deepEqual(Object.keys(publicAbroad),['settings'],'Preference acknowledgements require no provider/Torn/runtime refresh');
// Expose the actual automatic-default function only in this isolated fixture.
vm.runInContext(read('src/background/abroad-stocks-service.js').replace('    ALARM,','    ALARM, detectTravelDefault,'),context);
const propertyRequest={};propertyRequest.promise=new Promise(resolve=>{propertyRequest.resolve=resolve;});
const propertyStarted={};propertyStarted.promise=new Promise(resolve=>{propertyStarted.resolve=resolve;});
api.services.permissionAccess={settings:async()=>({tornKey:'synthetic-only'})};
api.core.tornApiLimiter={reserve:async()=>{}};
api.core.http={requestJson:async()=>{propertyStarted.resolve();return propertyRequest.promise;}};
records.set('abroadStocks.settings.v1',{travelMethodExplicit:false,travelDefault:'standard',arrivalBufferMinutes:0,alertLeadMinutes:0,futureOption:'keep'});
const automatic=api.services.abroadStocks.detectTravelDefault({}, {travelMethodExplicit:false,travelDefault:'standard'});
await propertyStarted.promise;
await api.services.abroadStocks.routes['abroadStocks.settings.save']({settings:{travelMethod:'business'}});
propertyRequest.resolve({property:{modifications:['Airstrip']}});
await automatic;
saved=records.get('abroadStocks.settings.v1');
assert.equal(saved.travelMethod,'business','A delayed property response must not replace the manually selected travel method');
assert.equal(saved.travelMethodExplicit,true);assert.equal(saved.travelDefault,'airstrip');assert.equal(saved.arrivalBufferMinutes,0);
vm.runInContext(read('src/core/money-property.js'),context);
vm.runInContext(read('src/background/money-property-service.js'),context);
api.services.permissionAccess.ensureSession=async()=>({userId:1});
api.core.permissions={hasScope:()=>true};
const finance=api.services.moneyProperty.routes;
const financeKey='money-property.settings.v1';
records.set(financeKey,{bankAmount:1000000,bankLeadHours:2,rentalLeadDays:3,cashierLeadHours:24,upkeepThreshold:1000000,stockAlerts:{old:true},snoozedUntil:{'money-property:old':123},futureOption:'keep'});
records.set('money-property.runtime.v2',{status:null,fetchedAt:42});
const oldFinanceRuntime=structuredClone(records.get('money-property.runtime.v2'));
await Promise.all([
 finance['money-property.settings.save']({bankAmount:123456789,bankLeadHours:0}),
 finance['money-property.stock-alert']({key:'one',enabled:true}),
 finance['money-property.stock-alert']({key:'two',enabled:true}),
 finance['money-property.snooze']({id:'money-property:bank',durationMs:300000})
]);
saved=records.get(financeKey);
assert.equal(saved.bankAmount,123456789);assert.equal(saved.bankLeadHours,0);
assert.deepEqual(saved.stockAlerts,{old:true,one:true,two:true});
assert.equal(saved.snoozedUntil['money-property:old'],123);assert(saved.snoozedUntil['money-property:bank']>Date.now());assert.equal(saved.futureOption,'keep');
assert.deepEqual(records.get('money-property.runtime.v2'),oldFinanceRuntime,'Preference saves must not rewrite the financial snapshot');
const financeAck=await finance['money-property.settings.save']({rentalLeadDays:0,cashierLeadHours:0,upkeepThreshold:0,stockAlerts:{three:true}});
assert.equal(financeAck.settings.rentalLeadDays,0);assert.equal(financeAck.settings.cashierLeadHours,0);assert.equal(financeAck.settings.upkeepThreshold,0);
assert.equal(financeAck.settings.stockAlerts.one,true);assert.equal(financeAck.settings.stockAlerts.three,true);
assert.deepEqual(Object.keys(financeAck),['settings']);
fail=true;await assert.rejects(()=>finance['money-property.settings.save']({bankAmount:5}),/injected storage failure/);
await finance['money-property.stock-alert']({key:'two',enabled:false});assert.equal(records.get(financeKey).bankAmount,123456789);assert.equal(records.get(financeKey).stockAlerts.two,false);
// A blocked authorization is outside the local mutation queue: snoozes still save.
let finishAuth,startAuth;const authPending=new Promise(resolve=>{finishAuth=resolve;});const authStarted=new Promise(resolve=>{startAuth=resolve;});
api.services.permissionAccess.ensureSession=()=>{startAuth();return authPending;};
const blockedFinanceSave=finance['money-property.settings.save']({bankAmount:100});await authStarted;
await finance['money-property.snooze']({id:'money-property:while-auth',durationMs:60000});
assert(records.get(financeKey).snoozedUntil['money-property:while-auth']>Date.now());
// Later authorization can finish earlier, but same-preference intent stays FIFO.
api.services.permissionAccess.ensureSession=async()=>({});
const laterFinanceSave=finance['money-property.settings.save']({bankAmount:200});
finishAuth({});await Promise.all([blockedFinanceSave,laterFinanceSave]);assert.equal(records.get(financeKey).bankAmount,200);
api.services.permissionAccess.ensureSession=async()=>{throw Error('injected permission denial');};
await assert.rejects(()=>finance['money-property.stock-alert']({key:'denied',enabled:true}),/permission denial/);
assert.equal(records.get(financeKey).stockAlerts.denied,undefined);
api.services.permissionAccess.ensureSession=async()=>({});
await finance['money-property.settings.save']({bankAmount:3000000000});assert.equal(records.get(financeKey).bankAmount,2000000000);
console.log('Settings queues: concurrent preferences/stock/snoozes, failure recovery, data retention, normalization, permission FIFO and unblocked local snoozes passed.');
