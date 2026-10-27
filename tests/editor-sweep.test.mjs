import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const read=name=>fs.readFileSync(new URL('../'+name,import.meta.url),'utf8');
const records=new Map();let fail=false;
const scopes=[];
const api={core:{storage:{get:async(key,fallback)=>structuredClone(records.get(key)??fallback),set:async(key,value)=>{await new Promise(resolve=>setImmediate(resolve));if(fail){fail=false;throw Error('injected local write failure');}records.set(key,structuredClone(value));}}},services:{permissionAccess:{ensureSession:async(_force,scope)=>{scopes.push(scope);return {userId:1,factionId:55,token:'synthetic',scopes:['admin.*']};}}},define(group,key,value){(this[group]??={})[key]=value;}};
const context=vm.createContext({SLINK_EXTENSION:api,console,structuredClone,crypto:{randomUUID:()=> 'synthetic-uuid'}});
for(const name of ['permissions','faction-officers'])vm.runInContext(read('src/core/'+name+'.js'),context);
vm.runInContext(read('src/background/faction-officer-service.js'),context);
const officer=api.services.factionOfficer.routes,defs=api.core.factionOfficers;
const [first,second]=defs.ARMORY_ITEMS;
records.set('faction.officer.settings.v1',{armory:{checksPerDay:4,soundEnabled:true,thresholds:{[first.key]:5,[second.key]:6,future:99},futureKind:'keep'},oc:{checksPerDay:2,thresholds:{},soundEnabled:true},snoozedUntil:{prior:123},futureRecord:'keep'});
await Promise.all([
 officer['faction.officer.settings.save']({armory:{thresholds:{[first.key]:10}}}),
 officer['faction.officer.settings.save']({armory:{thresholds:{[second.key]:20}}}),
 officer['faction.officer.settings.save']({oc:{checksPerDay:0,soundEnabled:false}}),
 officer['faction.officer.alert.snooze']({id:'factionArmory',durationMs:300000})
]);
let stored=records.get('faction.officer.settings.v1');
assert.equal(stored.armory.thresholds[first.key],10);assert.equal(stored.armory.thresholds[second.key],20);assert.equal(stored.armory.thresholds.future,99);
assert.equal(stored.armory.futureKind,'keep');assert.equal(stored.futureRecord,'keep');assert.equal(stored.oc.checksPerDay,0);assert.equal(stored.oc.soundEnabled,false);assert.equal(stored.snoozedUntil.prior,123);assert(stored.snoozedUntil.factionArmory>Date.now());
assert(scopes.includes(defs.ARMORY_SCOPE)&&scopes.includes(defs.OC_SCOPE));
fail=true;await assert.rejects(()=>officer['faction.officer.settings.save']({armory:{checksPerDay:8}}),/local write failure/);
const receipt=await officer['faction.officer.settings.save']({armory:{checksPerDay:99}});assert.equal(receipt.settings.armory.checksPerDay,24);assert.deepEqual(Object.keys(receipt),['settings']);
let finishAuth,startedAuth;
const authorization=new Promise(resolve=>{finishAuth=resolve;}),started=new Promise(resolve=>{startedAuth=resolve;});
api.services.permissionAccess.ensureSession=()=>{startedAuth();return authorization;};
const blocked=officer['faction.officer.settings.save']({armory:{soundEnabled:false}});await started;
await officer['faction.officer.alert.snooze']({id:'factionOcStock'});finishAuth({});await blocked;
assert(records.get('faction.officer.settings.v1').snoozedUntil.factionOcStock>Date.now());
api.services.permissionAccess.ensureSession=async()=>{throw Error('scope denied');};
await assert.rejects(()=>officer['faction.officer.settings.save']({armory:{checksPerDay:7}}),/scope denied/);
assert.equal(records.get('faction.officer.settings.v1').armory.checksPerDay,24);
api.services.permissionAccess.ensureSession=async()=>({scopes:['admin.*']});
records.set('permissions.snapshot',{scopes:['admin.*']});
records.set('faction.officer.stock.runtime.v1',{lastArmoryCheckAt:Date.now(),inventory:[],points:0});
const cached=await officer['faction.officer.status']({refreshIfDue:false});
assert.equal(cached.access.armory,true);assert.equal(cached.access.oc,true);assert.equal(cached.access.admin,true);
assert(cached.runtime.armoryShortages.some(row=>row.target===10),'Cached inventory must be reevaluated against current thresholds without API calls');

vm.runInContext(read('src/background/chat-config-service.js'),context);
const chat=api.services.chatConfig.routes;
records.set('qol.chat.highlights.v1',{future:'keep',highlights:[{id:'one',term:'hello',color:'yellow',enabled:true,futureRow:'keep'},{id:'two',term:'world',color:'green',enabled:true}]});
await Promise.all([chat['chat.highlights.patch']({id:'one',changes:{term:' updated '}}),chat['chat.highlights.patch']({id:'one',changes:{enabled:false}}),chat['chat.highlights.patch']({id:'two',changes:{color:'blue'}})]);
stored=records.get('qol.chat.highlights.v1');assert.equal(stored.future,'keep');assert.equal(stored.highlights[0].term,'updated');assert.equal(stored.highlights[0].enabled,false);assert.equal(stored.highlights[0].futureRow,'keep');assert.equal(stored.highlights[1].color,'blue');
fail=true;await assert.rejects(()=>chat['chat.highlights.patch']({id:'one',changes:{term:'lost'}}),/local write failure/);
await chat['chat.highlights.patch']({id:'one',changes:{color:'red'}});assert.equal(records.get('qol.chat.highlights.v1').highlights[0].term,'updated');
await chat['chat.highlights.remove']({id:'one'});await assert.rejects(()=>chat['chat.highlights.patch']({id:'one',changes:{term:'resurrect'}}),/removed/);
assert.equal(records.get('qol.chat.highlights.v1').highlights.some(row=>row.id==='one'),false);
await chat['chat.highlights.add']({id:'new'});assert.equal((await chat['chat.highlights.get']()).highlights.find(row=>row.id==='new').term,'');
api.services.permissionAccess.ensureSession=async()=>({scopes:[]});
await assert.rejects(()=>chat['chat.highlights.patch']({id:'new',changes:{term:'denied'}}),/Chat permission/);
api.services.permissionAccess.ensureSession=async()=>({scopes:['admin.*']});
records.set('qol.chat.macros.v1',{revision:0,macros:[],legacyImported:true,future:'keep'});
let releaseMacroAuth,macroAuthStarted;const macroAuth=new Promise(resolve=>{releaseMacroAuth=resolve;}),macroStarted=new Promise(resolve=>{macroAuthStarted=resolve;});
api.services.permissionAccess.ensureSession=()=>{macroAuthStarted();return macroAuth;};
const payload={expectedRevision:0,macros:[{id:'m',label:'Before',message:'Original',scope:'both',enabled:true}]};
const savedMacro=chat['chat.macros.save'](payload);await macroStarted;payload.macros[0].message='Changed after submit';releaseMacroAuth({scopes:['admin.*']});
await savedMacro;assert.equal(records.get('qol.chat.macros.v1').macros[0].message,'Original');assert.equal(records.get('qol.chat.macros.v1').future,'keep');
// Exercise the real mutation owners with deterministic local provider adapters.
// No network/authentication is necessary to prove record merge and retry behavior.
vm.runInContext(read('src/core/market.js'),context);
vm.runInContext(read('src/background/market-service.js').replace("  SLINK.define('services', 'market',", `
  accessState=async()=>({permitted:true,limit:10});
  ensureCatalog=async()=>({items:[{id:1,name:'One'},{id:2,name:'Two'}]});
  refresh=async()=>{};
  publicStatus=async()=>({settings:await settings()});
  SLINK.testMarket={saveSettings,upsertWatch,toggleWatch,removeWatch,pruneWeaverSelection};
  SLINK.define('services', 'market',`),context);
const market=api.testMarket;
records.set('market.settings.v1',{future:'keep',weaverActiveItemIds:[2],watches:[{uid:'a',itemId:1,maxPrice:10,enabled:true,futureRow:'keep'}]});
await Promise.all([market.saveSettings({soundEnabled:false,preferenceOnly:true}),market.saveSettings({quickBuyEnabled:false,preferenceOnly:true}),market.toggleWatch({uid:'a',enabled:false})]);
stored=records.get('market.settings.v1');
assert.equal(stored.soundEnabled,false);assert.equal(stored.quickBuyEnabled,false);assert.equal(stored.future,'keep');assert.equal(stored.watches[0].futureRow,'keep');assert.equal(stored.watches[0].enabled,false);assert.deepEqual(stored.weaverActiveItemIds,[2]);
fail=true;await assert.rejects(()=>market.saveSettings({soundEnabled:true,preferenceOnly:true}),/local write failure/);
assert.deepEqual(Object.keys(await market.saveSettings({showInTorn:false,preferenceOnly:true})),['settings']);
assert.equal(records.get('market.settings.v1').soundEnabled,false);
await Promise.all([market.upsertWatch({uid:'a',requireExisting:true,itemId:1,maxPrice:99,enabled:true}),market.toggleWatch({uid:'a',enabled:false})]);
stored=records.get('market.settings.v1');assert.equal(stored.watches[0].maxPrice,99);assert.equal(stored.watches[0].enabled,false);assert.equal(stored.watches[0].futureRow,'keep');
await market.removeWatch({uid:'a'});
await assert.rejects(()=>market.upsertWatch({uid:'a',requireExisting:true,itemId:1,maxPrice:50}),/removed/);
assert.equal(records.get('market.settings.v1').watches.length,0);

vm.runInContext(read('src/core/merits.js'),context);
vm.runInContext(read('src/background/merits-service.js').replace("  SLINK.define('services', 'merits',", `
  publicStatus=async()=>({settings:await settings()});
  SLINK.testMerits={saveSettings,setPinned};
  SLINK.define('services', 'merits',`),context);
const merit=api.testMerits;
records.set('merits.settings.v1',{filter:'all',refreshMinutes:15,pinned:[],future:'keep'});
await Promise.all([merit.saveSettings({filter:'medal',preferenceOnly:true}),merit.setPinned({key:'medal:1'}),merit.setPinned({key:'honor:2'}),merit.saveSettings({refreshMinutes:30,preferenceOnly:true})]);
stored=records.get('merits.settings.v1');assert.equal(stored.filter,'medal');assert.equal(stored.refreshMinutes,30);assert.equal(stored.future,'keep');assert.deepEqual(stored.pinned,['medal:1','honor:2']);
fail=true;await assert.rejects(()=>merit.saveSettings({filter:'honor',preferenceOnly:true}),/local write failure/);
await merit.setPinned({key:'medal:3'});await assert.rejects(()=>merit.setPinned({key:'medal:4'}),/up to 3/);
assert.equal(records.get('merits.settings.v1').filter,'medal');
assert.deepEqual(Object.keys(await merit.saveSettings({filter:'all',preferenceOnly:true})),['settings']);
console.log('Consolidated editor owners: Officer scoped merge, Chat row/macro safety, Market independent watch/preferences, Merits pin/preferences and failed-write recovery passed.');
