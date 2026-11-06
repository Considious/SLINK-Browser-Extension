import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');
function setup(initial={}){
 const values=new Map(Object.entries(initial)),timers=[];let uid=0;
 const api={core:{storage:{get:async(k,f)=>values.has(k)?values.get(k):f,set:async(k,v)=>values.set(k,v)},adhd:{marketWatchLimit:s=>s.scopes?.some(x=>x==='slink.adhd.marketwatch.5')?5:0}},define(g,n,v){this[g][n]=v;}};
 const context={SLINK_EXTENSION:api,Date,console,crypto:{randomUUID:()=>String(++uid)},setTimeout:fn=>timers.push(fn)};context.globalThis=context;
 vm.runInNewContext(read('src/core/market.js'),context);vm.runInNewContext(read('src/core/torn-api-limiter.js'),context);
 return {api,values,timers};
}
const event=(i,priority='normal')=>({id:String(i),at:Date.now()-i,priority,endpoint:'/test'});
const settings={enabled:true,listedItemsEnabled:true,watches:Array.from({length:5},(_,i)=>({enabled:true,itemId:i+1,maxPrice:100,marketEnabled:true}))};
function foreground(events=[]){return {'access.session.v1':{token:'test',expiresAt:Date.now()+60000,scopes:['slink.adhd.alerts','slink.adhd.marketwatch.5']},'market.settings.v1':settings,'market.activity.v1':{lastActiveAt:Date.now()},'core.tornApiLedger.v1':{events}};}
test('global cache deadline plus one second remains aligned even when Torn repeats stale prices',()=>{
 const {api}=setup(),m=api.core.market;
 assert.equal(m.WEAVER_SUMMARY_REFRESH_MS,10000);
 assert.equal(m.itemMarketNextCheckAt({fetchedAt:1000000,cacheTimestamp:1000,cacheDelayMs:30000}),1031000);
 assert.equal(m.itemMarketNextCheckAt({fetchedAt:1031000,cacheTimestamp:1000,cacheDelayMs:30000}),1061000);
 assert.equal(m.itemMarketNextCheckAt({fetchedAt:1135000,cacheTimestamp:1000,cacheDelayMs:30000}),1151000);
 assert.equal(m.itemMarketNextCheckAt({fetchedAt:1000000,cacheTimestamp:1000,cacheDelayMs:null}),1030000);
 let time=1000000,calls=0;while(time<1120000){calls+=5;time=m.itemMarketNextCheckAt({fetchedAt:time,cacheTimestamp:1000,cacheDelayMs:30000});}assert.equal(calls,20,'Five watches must not spiral to 60 calls/minute on stale cache');
});
test('forecast market demand and alert capacity are protected from background contributions',async()=>{
 const {api,values}=setup(foreground());const l=api.core.tornApiLimiter;
 assert.equal((await l.getContributionCapacity()).foregroundReserved,15);
 assert.equal((await l.getContributionCapacity()).available,35);
 values.set('core.tornApiLedger.v1',{events:Array.from({length:35},(_,i)=>event(i,'contribution'))});
 await assert.rejects(l.reserveContribution({wait:false}),e=>e.code==='SLINK_TORN_API_LIMIT');
 const watched=await l.reserve({wait:false,priority:'market'});assert.equal(watched.count,36);
 values.set('market.activity.v1',{lastActiveAt:Date.now()-300001});assert.equal((await l.getContributionCapacity()).foregroundReserved,5);
});
test('general alerts outrank watches, and watches outrank other active consumers',async()=>{
 const {api,values}=setup(foreground(Array.from({length:45},(_,i)=>event(i))));const l=api.core.tornApiLimiter;
 await assert.rejects(l.reserve({wait:false,priority:'normal'}),e=>e.code==='SLINK_TORN_API_LIMIT');
 assert.equal((await l.reserve({wait:false,priority:'market'})).count,46);
 values.set('core.tornApiLedger.v1',{events:Array.from({length:55},(_,i)=>event(i))});
 await assert.rejects(l.reserve({wait:false,priority:'market'}),e=>e.code==='SLINK_TORN_API_LIMIT');
 assert.equal((await l.reserve({wait:false,priority:'alerts'})).count,56);
});
test('a waiting lower-priority request releases the queue so an alert can pass it',async()=>{
 const {api,values,timers}=setup(foreground(Array.from({length:45},(_,i)=>event(i))));const l=api.core.tornApiLimiter;
 const waiting=l.reserve({priority:'normal'});
 for(let i=0;i<30&&!timers.length;i++)await new Promise(setImmediate);
 assert.equal(timers.length,1);assert.equal((await l.reserve({wait:false,priority:'alerts'})).count,46);
 values.set('core.tornApiLedger.v1',{events:[]});timers.shift()();await waiting;
});
test('an empty Weaver full-market response is cached for the complete ten-second interval',async()=>{
 const {api}=setup();const source=read('src/background/market-service.js'),start=source.indexOf('  async function ensureWeaverSummary('),end=source.indexOf('  function weaverTargets(',start);
 let now=1000000,calls=0;const context=vm.createContext({Date:{now:()=>now},MARKET:api.core.market,weaverJson:async()=>{calls++;return {items:[]};}});
 vm.runInContext(source.slice(start,end),context);const state={};await context.ensureWeaverSummary(state);now+=9999;await context.ensureWeaverSummary(state);assert.equal(calls,1);now++;await context.ensureWeaverSummary(state);assert.equal(calls,2);
});

