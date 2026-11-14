import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import vm from 'node:vm';
const shell={core:{},services:{},define(group,key,value){this[group][key]=value;}};
function install(file){vm.runInNewContext(readFileSync(new URL(file,import.meta.url),'utf8'),{SLINK_EXTENSION:shell,URL,URLSearchParams,setTimeout,clearTimeout});}
install('../src/core/player-intelligence.js');
const now=Date.now();
const record=(state,age,until=0)=>({playerId:1,state,observedAt:now-age,until,source:'bulk:faction-members'});
test('stable status uses bulk data; stakeout interval and timer transitions are preserved',()=>{
 const decide=(r,opts)=>shell.core.playerIntelligence.requestDecision(r,{now,...opts}).reason;
 assert.equal(decide(record('Okay',120000),{adaptive:true}),'fresh-cache');
 assert.equal(decide(record('Okay',120000),{}),'stale');
 assert.equal(decide(record('Federal',3600000),{adaptive:true}),'fresh-cache');
 assert.equal(decide(record('Hospital',20000,(now+60000)/1000),{adaptive:true}),'known-timer');
 assert.equal(decide(record('Hospital',20000,(now-1000)/1000),{adaptive:true}),'timer-ended');
});
test('bulk cache and concurrent status consumers share one attributed call; paused work sends none', async()=>{
 const values={};const calls=[];
 shell.core.storage={get:async (k,d)=>values[k]??d,set:async(k,v)=>{values[k]=v;}};
 shell.core.tornApiLimiter={reserve:async()=>{}};
 shell.core.http={requestJson:async(_host,url)=>{calls.push(url);return {profile:{status:{state:'Okay'}}};}};
 install('../src/background/player-intelligence-service.js');
 const intel=shell.services.playerIntelligence;
 await intel.observeMany([record('Okay',30_000)]);
 assert.equal((await intel.refresh({playerId:1,owner:'polling',adaptive:true})).fetched,false);
 const results=await Promise.all([intel.refresh({playerId:2,owner:'mugging',apiKey:'fixture'}),intel.refresh({playerId:2,owner:'stakeout',apiKey:'fixture'})]);
 assert.equal(results.filter(x=>x.fetched).length,1);
 assert.equal(calls.length,1);assert.match(calls[0],/comment=SLINK%20Mug%20Ext/);
 assert.equal((await intel.refresh({playerId:3,apiKey:'fixture',active:()=>false})).reason,'inactive');
 assert.equal(calls.length,1);
});
test('inactive Mugging never asks for work; active work honors the worker budget',async()=>{
 const stored={'mugging.settings.v1':{enabled:true},'mugging.activity.v1':{lastActiveAt:Date.now()-600_000}};
 let work=0, checks=0;
 shell.core.storage={get:async(k,d)=>stored[k]??d,set:async(k,v)=>{stored[k]=v;}};
 shell.core.tornApiLimiter={getContributionCapacity:async()=>({available:36,count:0})};
 shell.core.permissions={hasScope:()=>true};
 shell.services.permissionAccess={ensureSession:async()=>({token:'fixture'})};
 shell.services.playerIntelligence={refresh:async()=>{checks++;return {fetched:false};}};
 shell.services.sharedData={peekPersonal:async()=>null};
 shell.core.http={requestJson:async(_service,url)=>{
   if(!url.endsWith('/tasks'))throw Error(url);
   work++;
   return {api_budget_per_minute:0,tasks:[{player_id:123}]};
 }};
 vm.runInNewContext(readFileSync(new URL('../src/background/mugging-service.js',import.meta.url),'utf8'),{
   SLINK_EXTENSION:shell,SLINK_MUGGING_FF:{create:()=>({check:async()=>{}})},URL,URLSearchParams
 });
 const run=shell.services.mugging.runContribution;
 assert.equal((await run({},null,()=>true)).mode,'inactive');
 stored['mugging.activity.v1'].lastActiveAt=Date.now();
 assert.equal((await run({},null,()=>false)).mode,'inactive');
 assert.equal(work,0);
 assert.equal((await run({},null,()=>true)).apiBudgetPerMinute,0);
 assert.equal(work,1);assert.equal(checks,0);
});
