import fs from 'node:fs';import vm from 'node:vm';import assert from 'node:assert/strict';
const records={},calls=[];let id=1,allowed=true,now=Date.now();
const S={core:{storage:{get:async(k,d)=>structuredClone(records[k]??d),set:async(k,v)=>{records[k]=structuredClone(v);}},permissions:{hasScope:()=>allowed},tornApiLimiter:{reserve:async opts=>calls.push(opts)},http:{requestJson:async(_,url)=>{
 if(url.includes('/perks'))return {perks:{faction:[],education:[]}};if(url.includes('/torn/items'))return {items:[{id:206,name:'Xanax',type:'Drug',effect:'250 energy',value:{market_price:800000}}]};if(url.includes('/user?'))return {life:{current:10,maximum:100},profile:{status:{state:'Okay'}}};return {schema:1,extension:{version:'0.19.64'}};
}}},services:{permissionAccess:{ensureSession:async()=>({userId:id}),settings:async()=>({tornKey:'test-only'})}},define(group,name,value){this[group][name]=value;}};
const box={SLINK_EXTENSION:S,console,Date,URL,Promise};box.globalThis=box;for(const file of ['qol-core.js','qol-extension-service.js'])vm.runInNewContext(fs.readFileSync(new URL(file==='qol-core.js'?'../src/core/qol.js':'../src/background/qol-service.js',import.meta.url),'utf8'),box);
const r=S.services.pageTools.routes;
await r['qol.save']({bloodType:'A+',favorites:[{id:'206',source:'inventory',name:'Xanax'}]});assert.equal((await r['qol.get']()).settings.favorites.length,1);
id=2;assert.equal((await r['qol.get']()).settings.bloodType,null,'No other account blood type');id=1;
const [a,b]=await Promise.all([r['qol.info']({}),r['qol.info']({})]);assert.equal(a.catalog.items[0].price,800000);assert.equal(calls.length,3,'Catalog, perks and state requests coalesce');await r['qol.info']({});assert.equal(calls.length,3,'Fresh metadata does not poll');
await r['qol.updates']();await r['qol.updates']();
allowed=false;await assert.rejects(()=>r['qol.save']({bloodType:'B+'}));
console.log('Service save, account separation, permissions and request coalescing passed');
