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
console.log('Settings queues: concurrent disjoint edits, snoozes, acknowledgements, failed writes, recovery and client patch routing passed.');
