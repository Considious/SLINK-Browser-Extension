const assert=require('node:assert/strict');
const {test}=require('node:test');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const read=p=>fs.readFileSync(path.join(__dirname,p),'utf8');
test('Access uses its existing ledger, redacts arbitrary paths, and separates maintenance',async()=>{
 const state=new Map(),at=Date.now();
 class Clock extends Date{static now(){return at;}}
 const SLINK_EXTENSION={core:{storage:{get:async(k,d)=>state.get(k)??d,set:async(k,v)=>state.set(k,v)}},define(group,k,v){this[group][k]=v;}};
 const context=vm.createContext({SLINK_EXTENSION,Date:Clock,crypto:globalThis.crypto});
 vm.runInContext(read('../src/core/access-usage.js'),context);vm.runInContext(read('../src/core/torn-api-limiter.js'),context);
 const limiter=SLINK_EXTENSION.core.tornApiLimiter,ui=context.SLINK_ACCESS_USAGE;
 await limiter.reserve({script:'SLINK Target List',endpoint:'/v2/user/3853023/basic?key=do-not-show'});
 await limiter.reserve({script:'SLINK Extension',endpoint:'/v2/user/abcdefghijklmnop?token=very-secret'});
 await limiter.reserveContribution({script:'SLINK Leveling',endpoint:'/v2/user/100/basic'});
 const shared=await limiter.syncShared({ledger:{events:[{id:'outside',at,script:'Other Tool',endpoint:'/v2/faction/wars'}]}});
 assert.equal(shared.ledger.events.length,4);assert.equal('history' in shared.ledger,false);
 const usage=await limiter.getAccessUsage(),raw=JSON.stringify(usage);
 assert.equal(usage.minute,4);assert.equal(usage.lastHour,3);assert.equal(usage.last5,3);
 assert.equal(usage.breakdown.targets.hour,1);assert.equal(usage.breakdown.maintenance.hour,1);assert.equal(usage.breakdown.external.minute,1);
 assert.match(raw,/user\/:id\/basic/);assert.match(ui.html(usage),/Largest identified user module: Target List/);
 assert.doesNotMatch(raw,/3853023|do-not-show|very-secret|abcdefghijklmnop/);
 state.set('access.session.v1',{scopes:['admin.*']});
 assert.equal((await limiter.getContributionCapacity()).available,0);
 await assert.rejects(limiter.reserve({priority:'contribution'}),{code:'SLINK_MAINTENANCE_ADMIN_EXCLUDED'});
 assert.equal((await limiter.getAccessUsage()).maintenance.adminExcluded,true);
});
