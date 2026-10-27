import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const read=file=>fs.readFileSync(new URL('../'+file,import.meta.url),'utf8');
const moduleSource=read('src/modules/war.js'),serviceSource=read('src/background/war-service.js');
assert(moduleSource.includes("addEventListener('click', saveWarSettings)"),'The production Save button must use the tested controller');
assert(moduleSource.includes('data-ui-explicit-commit="true"'),'War settings must opt out of guessed click-based draft release');
assert.doesNotMatch(moduleSource,/current\s*=\s*await\s+SLINK\.core\.messaging\.send/,'Status-returning actions must use the settings-revision fence');
function extract(source,name,indent) {
  const pattern=new RegExp(`^${' '.repeat(indent)}(?:async )?function ${name}\\(`,'m');
  const start=source.search(pattern);assert(start>=0,`Missing function ${name}`);
  const end=source.indexOf('\n'+' '.repeat(indent)+'}',start);
  const result=source.slice(start,end+indent+2);new vm.Script(result);return result;
}
const deferred=()=>{let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return {promise,resolve,reject};};
const settle=async()=>{for(let i=0;i<12;i++)await Promise.resolve();};
function fixture(officer=true) {
  const fields=new Map(Object.entries({'slink-war-display':'hybrid','slink-war-mode':'war','slink-war-idle':'5','slink-war-inside-cap':'0','slink-war-inside-mode':'warn','slink-war-sort':'availability'}).map(([id,value])=>[id,{id,value}]));
  fields.set('slink-war-accept',{id:'slink-war-accept',checked:false});
  const versions=new Map(),acks=[],requests=[],renders=[];
  const state={settings:{displayMode:'hybrid',warMode:'war'},sharedConfig:{mode:'war',idleMinutes:5,insideHitCap:0,insideBlockMode:'warn'},terms:{accepted:false},session:{officer},runtime:{test:0}};
  const sandbox=vm.createContext({current:structuredClone(state),settingsRevision:0,savingWarSettings:false,stopped:false,localError:'',targetSort:'availability',context:{signal:{aborted:false}},
    contentRoot:{querySelector:selector=>fields.get(selector.slice(1))||null},
    draftGuard:{begin:control=>({id:control.id,version:versions.get(control.id)||0}),commit:ticket=>{const current=(versions.get(ticket.id)||0)===ticket.version;acks.push({id:ticket.id,current});return current;}},
    SLINK:{core:{format:{errorMessage:error=>error.message},messaging:{send:(type,payload)=>{const reply=deferred();requests.push({type,payload,...reply});return reply.promise;}}}},
    render:()=>renders.push(sandbox.localError)
  });
  vm.runInContext(['requestWarStatus','settingsTickets','acknowledgeSettings','saveWarSettings'].map(name=>extract(moduleSource,name,6)).join('\n'),sandbox);
  return {sandbox,fields,acks,requests,renders,state,edit(id,value){const field=fields.get(id);if(id.endsWith('accept'))field.checked=value;else field.value=value;versions.set(id,(versions.get(id)||0)+1);}};
}

const partial=fixture();partial.edit('slink-war-display','torn');partial.edit('slink-war-accept',true);partial.edit('slink-war-mode','termed');partial.edit('slink-war-idle','10');
let saving=partial.sandbox.saveWarSettings();await partial.sandbox.saveWarSettings();
assert.equal(partial.requests.length,1,'Duplicate Save must not submit twice');
assert.equal(partial.requests[0].payload.displayMode,'torn');assert.equal(partial.requests[0].payload.acceptTerms,true);
partial.edit('slink-war-idle','25');partial.edit('slink-war-sort','fairFightDesc');
const localAck={...partial.state,settings:{displayMode:'torn'},terms:{accepted:true}};
partial.requests[0].resolve(localAck);await settle();
assert.equal(partial.requests[1].type,'war.config.save');assert.equal(partial.requests[1].payload.idleMinutes,'10','Faction payload must be captured before local-save await');
assert(partial.acks.some(row=>row.id==='slink-war-accept'&&row.current));
assert(!partial.acks.some(row=>row.id==='slink-war-idle'),'Do not release an unacknowledged faction draft');
partial.requests[1].reject(Error('faction write failed'));await saving;
assert.match(partial.sandbox.localError,/Local War settings saved.*faction write failed/);
assert.equal(partial.sandbox.current.terms.accepted,true);assert.equal(partial.sandbox.savingWarSettings,false);
assert(!partial.acks.some(row=>row.id==='slink-war-idle'));

const revoked=fixture();revoked.edit('slink-war-mode','termed');saving=revoked.sandbox.saveWarSettings();
revoked.requests[0].resolve({...revoked.state,session:{officer:false}});await saving;
assert.equal(revoked.requests.length,1,'Do not attempt faction writes after officer access is lost');
assert.match(revoked.sandbox.localError,/Officer access/);

const success=fixture();success.edit('slink-war-idle','99');success.edit('slink-war-sort','fairFightAsc');
saving=success.sandbox.saveWarSettings();success.requests[0].resolve(success.state);await settle();
success.edit('slink-war-idle','12');success.edit('slink-war-sort','fairFightDesc');
success.requests[1].resolve({...success.state,sharedConfig:{...success.state.sharedConfig,idleMinutes:60}});await saving;
assert.equal(success.requests[1].payload.idleMinutes,'99');
assert.equal(success.sandbox.current.sharedConfig.idleMinutes,60);
assert(success.acks.some(row=>row.id==='slink-war-idle'&&!row.current),'Newer typing must not be acknowledged by the older save');
assert(success.acks.some(row=>row.id==='slink-war-sort'&&!row.current));
assert.equal(success.sandbox.targetSort,'fairFightAsc','Saved sort must use the click-time snapshot');

const fence=fixture();let old=fence.sandbox.requestWarStatus('war.status');fence.sandbox.settingsRevision++;
fence.sandbox.current={...fence.state,settings:{displayMode:'torn'},sharedConfig:{mode:'termed'},terms:{accepted:true}};
fence.requests[0].resolve({...fence.state,session:{officer:false},runtime:{test:99}});const adopted=await old;
assert.equal(adopted.settings.displayMode,'torn');assert.equal(adopted.sharedConfig.mode,'termed');assert.equal(adopted.terms.accepted,true);
assert.equal(adopted.runtime.test,99);assert.equal(adopted.session.officer,false,'Never freeze old officer rights when fencing presentation fields');

for(const officer of [true,false]){
 const unchanged=fixture(officer);saving=unchanged.sandbox.saveWarSettings();unchanged.requests[0].resolve(unchanged.state);await saving;
 assert.equal(unchanged.requests.length,1,'Unchanged faction fields must not cause a faction-wide write');
 assert.equal(Object.keys(unchanged.requests[0].payload).length,0,'Do not resend unchanged local fields');
}
const stopped=fixture();stopped.edit('slink-war-mode','termed');saving=stopped.sandbox.saveWarSettings();stopped.sandbox.stopped=true;
const renderCount=stopped.renders.length;stopped.requests[0].resolve(stopped.state);await saving;
assert.equal(stopped.requests.length,1);assert.equal(stopped.renders.length,renderCount);
const failed=fixture();saving=failed.sandbox.saveWarSettings();failed.requests[0].reject(Error('local rejected'));await saving;
assert.equal(failed.acks.length,0,'Failed local save must not release any draft');
assert.match(failed.sandbox.localError,/local rejected/);

// Execute the actual local mutation function, with network/authorization
// dependencies stubbed. A blocked network continuation must not hold its queue.
const records=new Map([['war.settings.v1',{tornKey:'keep-torn',ffKey:'keep-ff',unknownFutureSetting:'retain'}]]);
let failWrite=false,publicGate=null,termsGate=null,sessionChecks=0,observeWrite=null;
const service=vm.createContext({settingsQueue:Promise.resolve(),KEYS:{settings:'war.settings.v1',acceptedTerms:'war.acceptedTerms.v1'},
 SLINK:{core:{storage:{get:async(key,fallback)=>structuredClone(records.get(key)??fallback),set:async(key,value)=>{await new Promise(resolve=>setImmediate(resolve));if(failWrite){failWrite=false;throw Error('storage rejected');}records.set(key,structuredClone(value));observeWrite?.(key,value);}}}},
 fetchTerms:async()=>termsGate?termsGate.promise:{version:'test',sha256:'hash'},ensureSession:async()=>{sessionChecks++;},
 publicStatus:async()=>{if(publicGate)await publicGate.promise;return service.settings();}
});
vm.runInContext(['defaults','settings','saveSettings'].map(name=>extract(serviceSource,name,2)).join('\n'),service);
const save=service.saveSettings;
await Promise.all([save({minFF:2}),save({maxFF:2.9}),save({alertSound:false})]);
let saved=records.get('war.settings.v1');assert.equal(saved.minFF,2);assert.equal(saved.maxFF,2.9);assert.equal(saved.alertSound,false);assert.equal(saved.unknownFutureSetting,'retain');
await save({tornKey:'',ffKey:'',idleMinutes:999});saved=records.get('war.settings.v1');
assert.equal(saved.tornKey,'keep-torn');assert.equal(saved.ffKey,'keep-ff');assert.equal(saved.idleMinutes,60);
failWrite=true;await assert.rejects(()=>save({minFF:1.5}),/storage rejected/);await save({maxFF:2.5});
assert.equal(records.get('war.settings.v1').minFF,2);assert.equal(records.get('war.settings.v1').maxFF,2.5);
function watchSetting(field,value){const completion=deferred();const timeout=setTimeout(()=>completion.reject(Error('Mutation queue blocked on network work: '+field)),1000);observeWrite=(key,row)=>{if(key==='war.settings.v1'&&row[field]===value)completion.resolve();};return completion.promise.finally(()=>{clearTimeout(timeout);observeWrite=null;});}
publicGate=deferred();let written=watchSetting('turtleMinutes',12),a=save({displayMode:'extension'}),b=save({turtleMinutes:12});
await written;assert.equal(records.get('war.settings.v1').turtleMinutes,12,'Public-status work must stay outside the mutation queue');
publicGate.resolve();await Promise.all([a,b]);publicGate=null;
termsGate=deferred();written=watchSetting('chainAlert',false);a=save({acceptTerms:true});b=save({chainAlert:false});
await written;assert.equal(records.get('war.settings.v1').chainAlert,false,'Terms fetch must not block unrelated setting commits');
termsGate.resolve({version:'test',sha256:'hash'});await Promise.all([a,b]);termsGate=null;
assert.equal(records.get('war.acceptedTerms.v1').sha256,'hash');assert.equal(sessionChecks,1);
assert.equal(records.get('ui.modules.war.showInTorn'),false);
console.log('War settings: captured payloads, partial acknowledgements, failures/newer drafts, role loss, stale-response fences and recoverable local mutation queue passed.');
