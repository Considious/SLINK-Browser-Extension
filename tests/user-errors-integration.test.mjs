import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const read=p=>fs.readFileSync(new URL('../src/'+p,import.meta.url),'utf8');
let mode='http';
const S={core:{permissions:{getCapability:()=>({origins:['https://api.torn.com/*'],label:'Torn'})}},define(group,key,value){this[group][key]=value;}};
const context=vm.createContext({SLINK_EXTENSION:S,URL,Response,AbortController,setTimeout,clearTimeout,console,
 chrome:{permissions:{contains:async()=>true},runtime:{id:'test'}},
 fetch:async()=>{if(mode==='network')throw Error('Failed to fetch');if(mode==='api')return new Response(JSON.stringify({error:{code:5,error:'Too many requests'}}));
 if(mode==='html')return new Response('<html>down</html>',{status:502});
 return new Response(JSON.stringify({error:'upstream down'}),{status:503,headers:{'Retry-After':'60'}});}
});
for(const p of ['core/errors.js','core/format.js','core/http.js','core/messaging.js'])vm.runInContext(read(p),context);
await assert.rejects(S.core.http.requestJson('tornApi','https://api.torn.com/v2/user'),e=>{
 assert.equal(e.status,503);assert.equal(e.code,'SLINK_HTTP_ERROR');assert.equal(e.retryAfterMs,60000);
 assert.match(S.core.format.errorMessage(e),/Torn.*HTTP 503/);return true;
});
mode='api';const api=await S.core.http.requestJson('tornApi','https://api.torn.com/v2/user');assert.equal(api.error.code,5);assert.equal(api.error.error,'Too many requests');assert.match(api.error.message,/Torn request allowance/);
mode='html';await assert.rejects(S.core.http.requestJson('tornApi','https://api.torn.com/v2/user'),e=>{assert.equal(e.status,502);assert.match(S.core.format.errorMessage(e),/HTTP 502/);return true;});
mode='network';await assert.rejects(S.core.http.requestText('tornApi','https://api.torn.com/v2/user'),e=>{assert.match(S.core.format.errorMessage(e),/connect to Torn/);return true;});
const router=S.core.messaging.createRouter({test:()=>{throw Object.assign(Error('HTTP 429'),{code:'SLINK_HTTP_ERROR',status:429,retryAfterMs:1234,provider:'weaver',data:{token:'never-send'}});}});
const reply=await new Promise(resolve=>router({channel:'slink',type:'test',payload:{}},{},resolve));
assert.equal(reply.error.status,429);assert.equal(reply.error.retryAfterMs,1234);assert.equal(reply.error.provider,'weaver');assert.equal(reply.error.code,'SLINK_HTTP_ERROR');assert(!JSON.stringify(reply).includes('never-send'));
context.chrome.runtime.sendMessage=async()=>reply;
await assert.rejects(S.core.messaging.send('test'),e=>e.status===429&&e.retryAfterMs===1234&&e.provider==='weaver');
const market=read('background/market-service.js');
const helper=market.slice(market.indexOf('  function weaverLimitKind('),market.indexOf('  function pruneWeaver('));
vm.runInContext("const WEAVER_DAILY_LIMIT_MESSAGE='daily limit';const WEAVER_MINUTE_LIMIT_MESSAGE='per-minute limit';"+helper,context);
assert.equal(context.weaverLimitKind({message:'Too many requests'}),'unknown');
assert.equal(context.weaverLimitKind({message:'daily quota'}),'daily');
assert.equal(context.weaverLimitKind({message:'per-minute limit'}),'minute');
assert.equal(context.weaverLimitError('unknown').code,'SLINK_WEAVER_LIMIT_UNKNOWN');
console.log('Extension HTTP, provider API errors, HTML 502, messaging metadata and unknown Weaver limit integration passed.');
