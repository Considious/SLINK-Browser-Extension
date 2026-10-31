import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const read=file=>fs.readFileSync(new URL('../'+file,import.meta.url),'utf8');
const deferred=()=>{let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return {promise,resolve,reject};};
const records=new Map();let fail=false,auth=deferred(),started=deferred();
const api={VERSION:'test',core:{workerClient:{BASE_URL:'https://fixture.invalid'},permissions:{hasScope:()=>true},storage:{get:async(key,fallback)=>structuredClone(records.get(key)??fallback),set:async(key,value)=>{if(fail){fail=false;throw Error('synthetic write failure');}records.set(key,structuredClone(value));}}},services:{},define(group,key,value){(this[group]??={})[key]=value;}};
const scope=vm.createContext({SLINK_EXTENSION:api,URL,URLSearchParams,console,structuredClone});
vm.runInContext(read('src/background/leveling-service.js').replace('  const api = Object.freeze({',`
  acceptedCurrentTerms=async()=>true;
  ensureSession=async()=>{SLINK.authStarted();return SLINK.authPromise;};
  clearSession=async()=>{};clearContributorSession=async()=>{};syncUserDemand=async()=>{};
  publicStatus=async()=>({settings:await settings()});
  SLINK.testLeveling={saveSettings,savePreferences};
  const api = Object.freeze({`),scope);
api.authStarted=()=>started.resolve();api.authPromise=auth.promise;
records.set('leveling.settings.v1',{tornKey:'synthetic-old',future:'retain',pollSeconds:300,minFF:1,maxFF:3});
const input={tornKey:'synthetic-new',pollSeconds:60};
const saving=api.testLeveling.saveSettings(input);input.tornKey='must-not-be-read-later';await started.promise;
await api.testLeveling.savePreferences({pollSeconds:120,minFF:2.4});auth.resolve({});await saving;
let stored=records.get('leveling.settings.v1');
assert.equal(stored.tornKey,'synthetic-new');assert.equal(stored.pollSeconds,120);assert.equal(stored.minFF,2.4);assert.equal(stored.future,'retain');
assert.deepEqual(Object.keys(await api.testLeveling.savePreferences({maxFF:2.9})),['settings']);
fail=true;await assert.rejects(()=>api.testLeveling.savePreferences({pollSeconds:240}),/synthetic write failure/);
await api.testLeveling.savePreferences({maxFF:3});assert.equal(records.get('leveling.settings.v1').pollSeconds,120);
await assert.rejects(()=>api.testLeveling.savePreferences({minFF:''}),/valid/);
assert.equal(records.has('leveling.acceptedTerms.v1'),false,'Personal preference changes must not accept terms');

const dashboard=read('src/dashboard/dashboard.js');
function extract(name){const start=dashboard.search(new RegExp('^  (?:async )?function '+name+'\\(','m'));assert(start>=0,name);return dashboard.slice(start,dashboard.indexOf('\n  }',start)+4);}
const requests=[],timers=new Map();let nextTimer=0;
const sandbox=vm.createContext({market:{settings:{soundEnabled:true},permitted:true},merits:{settings:{filter:'all'}},editorRequests:{market:{version:0,sequence:0,applied:0,pending:0,timer:null},merits:{version:0,sequence:0,applied:0,pending:0,timer:null}},
 setTimeout:callback=>{const id=++nextTimer;timers.set(id,callback);return id;},clearTimeout:id=>timers.delete(id),
 SLINK:{core:{messaging:{send:(type,payload)=>{const reply=deferred();requests.push({type,payload,...reply});return reply.promise;}}}},renderMarket(){},renderMerits(){},byId:()=>({}),errorText:e=>e.message});
vm.runInContext(['scheduleEditorStatus','saveEditorPreference','requestEditorStatus'].map(extract).join('\n'),sandbox);
const stale=sandbox.requestEditorStatus('market','market.status',{refreshIfDue:false});
const pref=sandbox.saveEditorPreference('market',{soundEnabled:false});requests[1].resolve({settings:{soundEnabled:false}});await pref;
sandbox.market.settings.soundEnabled=false;
requests[0].resolve({settings:{soundEnabled:true},permitted:false});
const fenced=await stale;assert.equal(fenced.settings.soundEnabled,false);assert.equal(fenced.permitted,false,'Protecting a draft must not freeze fresh access metadata');
const oldRead=sandbox.requestEditorStatus('merits','merits.status');const newRead=sandbox.requestEditorStatus('merits','merits.status');
requests[3].resolve({settings:{filter:'honor'},goals:[1]});sandbox.merits=await newRead;
requests[2].resolve({settings:{filter:'all'},goals:[]});assert.equal((await oldRead).settings.filter,'honor');
const before=requests.length;const followup=[...timers.values()][0]();assert.equal(requests.length,before+1);assert.equal(requests.at(-1).payload.refreshIfDue,false,'Settled saves may request only a cached preview');
requests.at(-1).resolve({settings:{soundEnabled:false},permitted:true});await followup;
console.log('Leveling captured authentication/preferences, no stale final write, retry and dashboard latest-response/access fences passed.');
