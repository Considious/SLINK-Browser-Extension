import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
let now=Date.parse('2026-11-21T18:14:00Z'),owner=7,requests=0,paused=false;
class Clock extends Date{constructor(...args){super(...(args.length?args:[now]));}static now(){return now;}}
const saved={},services={permissionAccess:{ensureSession:async()=>({userId:owner}),settings:async()=>({tornKey:'fixture'})}};
const SLINK={services,core:{company:{SCOPE:'slink.qol.company'},storage:{get:async(k,f)=>k==='ui.monitoring.company.enabled'?!paused:saved[k]??f,set:async(k,v)=>{saved[k]=structuredClone(v);}},tornApiLimiter:{reserve:async()=>{}},http:{requestJson:async()=>{requests++;return {employees:[{id:owner,effectiveness:{addiction:-12}}]};}}},define:(area,name,value)=>{services[name]=value;}};
const read=name=>{const local=new URL(name,import.meta.url);return fs.readFileSync(fs.existsSync(local)?local:new URL('../src/background/'+name,import.meta.url),'utf8');};
vm.runInNewContext(read('company-service.js'),{SLINK_EXTENSION:SLINK,Date:Clock});
const check=services.company.routes['inline-status.company'];
assert.equal(await check(),null);assert.equal(requests,0);
now=Date.parse('2026-11-21T18:15:00Z');await Promise.all([check(),check()]);assert.equal(requests,1);assert.equal((await check()).penalty,-12);assert.equal(requests,1);
now+=86400000;await check();assert.equal(requests,2);owner=9;await check();assert.equal(requests,3);paused=true;await check();assert.equal(requests,3);
const alerts=read('adhd-service.js'),start=alerts.indexOf("'inline-status.virus':async()=>{"),end=alerts.indexOf("    async 'crimes.recipes.candidates'",start);
const expression='({'+alerts.slice(start,end)+'})';let virusRequests=0;
const route=vm.runInNewContext(expression,{SLINK,Date:Clock,requireAccess:async()=>({userId:owner}),accessKey:async()=>'fixture',tornJson:async()=>{virusRequests++;return {virus:{until:Math.floor(now/1000)+86400}};}})['inline-status.virus'];
await route();await route();assert.equal(virusRequests,1);now+=900001;await route();assert.equal(virusRequests,2);owner=11;await route();assert.equal(virusRequests,3);
console.log('Sidebar services: daily window, one request per day, concurrent calls, owner separation, pause and virus cache passed.');
