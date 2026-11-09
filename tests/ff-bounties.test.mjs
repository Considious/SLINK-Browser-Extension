import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const ctx=vm.createContext({URL,Date});
vm.runInContext(readFileSync(new URL('../src/core/ff-bounties.js',import.meta.url),'utf8'),ctx);
const make=ctx.SLINK_FF_BOUNTIES.service;
const own='0123456789ABCDEF';
const empty={pending_claims:[],recent_hits:[],claim_history:[]};
let key='',registered=false,accepted=false,rate=false,tick=100,paths=[];
const run=make({getKey:async()=>key,now:()=>tick,async request(raw,body){
 const u=new URL(raw); assert.equal(u.origin,'https://ffscouter.com');assert.equal(u.searchParams.get('key'),key);
 const path=u.pathname.split('/').at(-1);paths.push(path);
 if(rate)throw {status:429,body:{error:key}};
 if(path==='check-key')return {is_registered:registered,key};
 if(path==='accept'){assert.equal(JSON.stringify(body),JSON.stringify({key,i_have_read_rules_and_data_policy:true}));accepted=true;return {ok:true};}
 if(!accepted)throw {status:403,body:{code:86,error:key}};
 if(path==='claims'){assert.equal(JSON.stringify(body),JSON.stringify({key}));return {claim:{id:1,state:'verifying'},claims:empty};}
 if(path==='status')return {claims:empty};
 return {board:{targets:[{target_name:'test '+key}],seller:{player_id:1}},claims:empty};
}});
assert.equal((await run('load')).state,'key');assert.equal(paths.length,0);
key='invalid';assert.equal((await run('load')).state,'invalid');
key=own;assert.equal((await run('load')).state,'registration');
registered=true;assert.equal((await run('load')).state,'policy');
assert.equal((await run('claim')).state,'policy');
const board=await run('accept');assert.equal(board.state,'ready');assert.ok(!JSON.stringify(board).includes(own));
const count=paths.length;await run('load');assert.equal(paths.length,count);
const submitted=await run('claim');assert.equal(submitted.submitted,true);assert.deepEqual(paths.slice(-4),['check-key','claims','status','board']);
rate=true;tick+=16000;assert.equal((await run('load')).state,'rate');
const rateCount=paths.length;assert.equal((await run('load')).state,'rate');assert.equal(paths.length,rateCount);
rate=false;key='FEDCBA9876543210';registered=false;assert.equal((await run('load')).state,'registration');
console.log('Fair Fight Bounties: key isolation, registration, policy, claim payload, refresh, redaction and rate-limit checks passed.');
