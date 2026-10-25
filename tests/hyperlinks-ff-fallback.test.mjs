import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');
const part=(s,a,b)=>{const x=s.indexOf(a),y=s.indexOf(b,x);assert.ok(x>=0&&y>x,a);return s.slice(x,y);};
const api={core:{},define(g,k,v){(this[g]??={})[k]=v;}};
const ctx=vm.createContext({SLINK_EXTENSION:api,console,URL});
vm.runInContext(read('src/core/format.js'),ctx);vm.runInContext(read('src/core/war.js'),ctx);
const format=api.core.format;
const original='🚨 Retaliation: Please Hospitalize 🚨<br>⚫ <a href=https://www.torn.com/profiles.php?XID=4055888>Skybr3aker [4055888]</a> - <a href="https://www.torn.com/page.php?sid=attack&user2ID=4055888">【ATTACK】</a> - (Stats: N/A)';
const expected='🚨 Retaliation: Please Hospitalize 🚨<br>⚫ <a href="https://www.torn.com/profiles.php?XID=4055888">Skybr3aker</a> [4055888] - <a href="https://www.torn.com/page.php?sid=attack&amp;user2ID=4055888">【ATTACK】</a> - (Stats: N/A)';
assert.equal(format.normalizeChatHtml(original),expected);assert.equal(format.normalizeChatHtml(expected),expected);
const moduleSource=read('src/modules/war.js');
Object.assign(ctx,{SLINK:api,escape:format.escapeHtml,profileUrl:id=>'https://www.torn.com/profiles.php?XID='+id,attackUrl:id=>'https://www.torn.com/page.php?sid=attack&user2ID='+id});
vm.runInContext(part(moduleSource,'      function retalCallout(','      async function copyRetal('),ctx);
const actual=ctx.retalCallout({attackerId:4055888,attackerName:'Skybr3aker'});
assert.ok(actual.startsWith(expected));assert.doesNotMatch(actual,/>Skybr3aker \[4055888\]<\/a>/);
assert.equal(format.fairFightNumber(null),null);assert.equal(format.fairFightNumber(false),null);assert.equal(api.core.war.normalizeMember({id:1,fairFight:null}).fairFight,null);
assert.match(format.fairFightLabel({fairFight:null}),/N\/A/);assert.match(format.fairFightLabel({fairFight:2,fairFightStale:true}),/cached estimate/);

let clock=2_000_000,cache={1:{value:2,battleStatsEstimate:1000,checkedAt:clock-600_000}},mode='fail';
const FakeDate=class extends Date{static now(){return clock;}};
api.core.storage={get:async()=>structuredClone(cache),set:async(_key,value)=>{cache=structuredClone(value);}};
api.core.http={requestJson:async()=>{if(mode==='fail')throw Error('injected outage');return [{player_id:2,fair_fight:2.5,bs_estimate:2000}];}};
Object.assign(ctx,{WAR:api.core.war,Date:FakeDate,KEYS:{ffCache:'cache'},structuredClone});
vm.runInContext(part(read('src/background/war-service.js'),'  function fairFightValue(','  function normalizeOutsideTarget('),ctx);
let members=await ctx.refineMembers([{id:1},{id:2},{id:3}],{ffKey:'fixture'});
assert.equal(members[0].fairFight,2);assert.equal(members[0].fairFightStale,true);assert.equal(members[1].fairFight,null);assert.equal(members[2].battleStatsEstimate,null);
mode='partial';members=await ctx.refineMembers([{id:1},{id:2},{id:3}],{ffKey:'fixture'});
assert.equal(members[0].fairFight,2,'Missing partial rows must not erase a known estimate.');assert.equal(members[1].fairFight,2.5);assert.equal(members[2].fairFight,null);
assert.equal(cache[1].checkedAt,clock-600_000,'An outage/omission must not make the old score look newly measured.');

// Actual Leveling and Bounty enrichment functions must tolerate the same failure.
api.core.http.requestJson=async()=>{throw Error('injected FF outage');};
Object.assign(ctx,{FF_CACHE_MS:300_000,finiteNumberOrNull:format.finiteEstimate,estimateFairFight:()=>null,localDifficulty:()=>null});
vm.runInContext(part(read('src/background/leveling-service.js'),'  async function enrichFairFight(','  async function pendingChecks(').replace('async function enrichFairFight','async function enrichLeveling'),ctx);
cache={1:{fairFight:2,bsEstimate:1000,source:'FFScouter',checkedAt:clock-600_000}};
const leveling=await ctx.enrichLeveling([{id:1},{id:2}],{}, {ffKey:'fixture',minFF:1,maxFF:3});
assert.equal(leveling[0].fair_fight,2);assert.equal(leveling[0].fair_fight_stale,true);assert.equal(leveling[1].fair_fight,null);
Object.assign(ctx,{CORE:{FF_CACHE_MS:300000,MAX_FF_TARGETS:100},reserveBudget:async()=>{}});
vm.runInContext(part(read('src/background/bounties-service.js'),'  async function enrichFairFight(','  function freshStart(').replace('async function enrichFairFight','async function enrichBounties'),ctx);
await ctx.enrichBounties([{id:1},{id:2}],'fixture',{ffBatchesPerMinute:5});
assert.equal(cache[1].fairFight,2);

// Actual HTTP adapter: rate limit -> bounded backoff, recovery and timeout.
let calls=0,transport='429',timers=[];
api.core.permissions={getCapability:()=>({origins:['https://ffscouter.com/*'],label:'FF'})};
const net=vm.createContext({SLINK_EXTENSION:api,URL,Date:FakeDate,AbortController,
 chrome:{permissions:{contains:async()=>true}},
 setTimeout(fn){timers.push(fn);return fn;},clearTimeout(fn){timers=timers.filter(x=>x!==fn);},
 fetch:async()=>{calls++;if(transport==='hang')return new Promise(()=>{});return{ok:transport==='ok',status:transport==='ok'?200:429,headers:{get:()=>null},text:async()=>JSON.stringify(transport==='ok'?[]:{error:'busy'})};}});
vm.runInContext(read('src/core/http.js'),net);
const request=()=>api.core.http.requestJson('ffscouter','https://ffscouter.com/api/v1/get-stats?key=fixture&targets=1');
await assert.rejects(request);await assert.rejects(request,/temporarily unavailable/);assert.equal(calls,1);
clock+=61_000;transport='ok';await request();assert.equal(calls,2);
transport='hang';const timeout=request();while(!timers.length)await Promise.resolve();timers[0]();await assert.rejects(()=>timeout,/timed out/);
console.log('Main hotfix: verified chat lineup, idempotent quoting, War/Leveling/Bounty outage fallback, unknown values, partial cache retention, HTTP timeout/backoff and recovery passed.');
