import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { webcrypto, createHash } from 'node:crypto';
const read=path=>fs.readFileSync(new URL('../'+path,import.meta.url),'utf8');

// Transactional fault-injection fixture. Real IndexedDB is also checked separately in a browser.
function indexedFixture() {
 const state={stores:new Map(),abortNextWrite:false,puts:0};
 function connection(){return {objectStoreNames:{contains:name=>state.stores.has(name)},createObjectStore:name=>state.stores.set(name,new Map()),close(){},
  transaction(names,mode){
   const working=new Map(names.map(name=>[name,new Map([...state.stores.get(name)].map(([k,v])=>[k,structuredClone(v)]))]));
   let pending=0,aborted=false,finished=false;
   const tx={error:null,abort(){if(finished||aborted)return;aborted=true;queueMicrotask(()=>tx.onabort?.());},objectStore(name){
    function request(action,write=false){
     const req={};pending++;
     queueMicrotask(()=>{
      if(aborted)return;
      try {req.result=action();req.onsuccess?.();if(write&&state.abortNextWrite){state.abortNextWrite=false;tx.abort();}}
      catch(error){tx.error=error;tx.abort();}
      pending--;
      queueMicrotask(()=>{if(!pending&&!aborted&&!finished){finished=true;if(mode==='readwrite')for(const [key,value]of working)state.stores.set(key,value);tx.oncomplete?.();}});
     });return req;
    }
    return {get:key=>request(()=>structuredClone(working.get(name).get(key))),getAll:()=>request(()=>[...working.get(name).values()].map(v=>structuredClone(v))),
     put:value=>request(()=>{state.puts++;working.get(name).set(name==='players'?value.id:value.key,structuredClone(value));},true)};
   }};return tx;
  }};}
 return {state,api:{open(){const request={};queueMicrotask(()=>{request.result=connection();if(!state.stores.size)request.onupgradeneeded?.();request.onsuccess?.();});return request;}}};
}

function instance(storage,fixture,options={}){
 let writes=0,removals=0,legacyReads=0;
 const slink={core:{},services:{},define(group,name,value){this[group]||={};this[group][name]=value;}};
 slink.core.storage={get:async(key,fallback)=>{
   if(key==='playerIntelligence.cache.v1' && ++legacyReads===2 && options.replaceDuringMigration)storage.set(key,options.replaceDuringMigration);
   return structuredClone(storage.has(key)?storage.get(key):fallback);
  },
  set:async(key,value)=>{writes++;const next=new Map(storage);next.set(key,value);const bytes=[...next].reduce((sum,[k,v])=>sum+Buffer.byteLength(k+JSON.stringify(v)),0);if(bytes>10485760)throw Error('Resource::kQuotaBytes quota exceeded');storage.set(key,structuredClone(value));},
  remove:async key=>{removals++;if(options.failCleanup){options.failCleanup=false;throw Error('injected cleanup failure');}storage.delete(key);}};
 const context=vm.createContext({console,SLINK_EXTENSION:slink,indexedDB:fixture.api,crypto:webcrypto,TextEncoder});
 for(const file of ['src/core/player-intelligence.js','src/background/player-intelligence-store.js','src/background/player-intelligence-service.js'])vm.runInContext(read(file),context);
 return {store:slink.services.playerIntelligenceStore,service:slink.services.playerIntelligence,storage:slink.core.storage,counts:()=>({writes,removals})};
}
const key='playerIntelligence.cache.v1';
const original=Object.fromEntries(Array.from({length:100},(_,i)=>[String(i+1),{playerId:i+1,name:'Player '+i,state:'Okay',observedAt:1000,checkedAt:1000,padding:'x'.repeat(75000)}]));
const settings={tornKey:'synthetic-key',enabled:true};
const targets={42:{name:'Saved target',notes:'Keep this note'}};
const storage=new Map([[key,structuredClone(original)],['war.settings.v1',settings],['targetList.entries.v1',targets],['other.cache','x'.repeat(2600000)]]);
const fixture=indexedFixture(),app=instance(storage,fixture);
await assert.rejects(app.storage.set('war.runtime.v1',{padding:'x'.repeat(500000)}),/kQuotaBytes/);
await app.store.prepare();
assert.equal(storage.has(key),false,'Old Chrome copy is removed only after successful migration');
const digest=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
assert.equal(digest(await app.store.all()),digest(original),'Every cached record must survive migration unchanged');
assert.deepEqual(storage.get('war.settings.v1'),settings);
assert.deepEqual(storage.get('targetList.entries.v1'),targets);
await app.storage.set('war.runtime.v1',{padding:'x'.repeat(500000)});
const putsBefore=fixture.state.puts;
await app.service.observe({playerId:42,name:'Fresh',state:'Okay',observedAt:3000});
assert.equal(fixture.state.puts-putsBefore,1,'A single observation must write only one database record');
assert.equal(storage.has(key),false,'Observations must not recreate the quota-limited aggregate');
assert.equal((await app.service.get({playerId:42})).record.name,'Fresh');
fixture.state.abortNextWrite=true;
await assert.rejects(app.service.observe({playerId:42,name:'Failed update',state:'Okay',observedAt:3500}),/interrupted/);
assert.equal((await app.service.get({playerId:42})).record.name,'Fresh','Failed writes must not change the committed record');
await app.service.observe({playerId:43,name:'Queue recovered',state:'Okay',observedAt:4000});
assert.equal((await app.service.get({playerId:43})).record.name,'Queue recovered','A failed write must not poison later observations');
const reopened=instance(storage,fixture);
assert.equal((await reopened.service.get({playerId:42})).record.name,'Fresh','Worker restart must retain migrated and updated data');

// Old builds may recreate a Chrome copy after rollback. Import its new data without downgrading newer database fields.
storage.set(key,{'42':{playerId:42,name:'Old',state:'Okay',observedAt:2000},'101':{playerId:101,name:'From rollback',state:'Okay',observedAt:4000}});
const afterRollback=instance(storage,fixture);
assert.equal((await afterRollback.service.get({playerId:42})).record.name,'Fresh');
assert.equal((await afterRollback.service.get({playerId:101})).record.name,'From rollback');

// A successful request is not a committed transaction: abort after its success event.
const failedFixture=indexedFixture(),failedData=new Map([[key,{'7':original['7']}]]);
failedFixture.state.abortNextWrite=true;
const failed=instance(failedData,failedFixture);
await assert.rejects(failed.store.prepare(),/interrupted/);
assert(failedData.has(key),'Aborted migration must keep the complete original copy');
assert.equal(failedFixture.state.stores.get('meta').size,0,'Import marker must roll back with the records');
await failed.store.prepare();
assert.equal((await failed.store.get(7)).name,original['7'].name,'A later attempt must recover');

const cleanupData=new Map([[key,{'7':original['7']}]]),cleanupFixture=indexedFixture();
const cleanup=instance(cleanupData,cleanupFixture,{failCleanup:true});
await assert.rejects(cleanup.store.prepare(),/cleanup failure/);
assert(cleanupData.has(key));
assert.equal(cleanupFixture.state.stores.get('players').size,1,'Committed copy survives cleanup failure');
const copied=cleanupFixture.state.puts;
await cleanup.store.prepare();
assert.equal(cleanupFixture.state.puts,copied,'Retrying cleanup must not reimport an identical stale copy');
assert.equal(cleanupData.has(key),false);
const restoreData=new Map([[key,{'7':original['7']}]]),restoreFixture=indexedFixture();
const restore=instance(restoreData,restoreFixture,{replaceDuringMigration:{'8':original['8']}});
await assert.rejects(restore.store.prepare(),/changed during migration/);
assert.equal(restore.counts().removals,0,'A changed legacy copy must not be deleted');
assert(restoreData.has(key));
await restore.store.prepare();
assert(await restore.store.get(7));assert(await restore.store.get(8),'A subsequent retry must merge the newly restored legacy data');
console.log('Quota recovery with a 7.5 MB cache, exact preservation, per-player writes, restarts, rollback upgrades, transaction aborts and cleanup retry passed.');
