import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {webcrypto} from 'node:crypto';
const source=fs.readFileSync(new URL('../src/background/permission-service.js',import.meta.url),'utf8');
async function run({changedKey=false,changedTerms=false,denied=false,blocked=false}={}){
 const session={token:'retained',expiresAt:Date.now()+3600000};
 const records=new Map([
  ['access.settings.v1',{enabled:true,tornKey:'same-key'}],
  ['access.session.v1',session],
  ['permissions.access',{scopes:['slink.adhd.alerts']}],
  ['access.acceptedTerms.v1',{version:'current',sha256:'hash'}]
 ]);
 const api={core:{
  storage:{get:async(key,fallback)=>records.get(key)??fallback,set:async(key,value)=>records.set(key,value),remove:async key=>records.delete(key)},
  adhd:{ALERT_SCOPE:'slink.adhd.alerts'},permissions:{recomputeStoredSnapshot:async()=>({})},
  tornApiLimiter:{reserve:async()=>{}},
  http:{requestJson:async(_provider,url)=>{
   if(url.endsWith('/terms'))return {terms:{version:changedTerms?'new':'current',sha256:'hash'}};
   throw Object.assign(Error('request failed'),blocked?{status:403,code:'SLINK_INVALID_JSON'}:denied?{status:403}:{});
  }}
 },define(group,key,value){(this[group]??={})[key]=value;}};
 const ctx=vm.createContext({SLINK_EXTENSION:api,crypto:webcrypto,TextEncoder,Date,console});
 vm.runInContext(source,ctx);
 await assert.rejects(api.services.permissionAccess.routes['access.settings.save']({enabled:true,tornKey:changedKey?'new-key':'same-key',acceptTerms:true}),/request failed/);
 return {retained:records.get('access.session.v1')===session};
}
assert.equal((await run()).retained,true);
assert.equal((await run({changedKey:true})).retained,false);
assert.equal((await run({changedTerms:true})).retained,false);
assert.equal((await run({denied:true})).retained,false);
assert.equal((await run({blocked:true})).retained,true);
console.log('Extension reverify preserves acknowledged access on transport failure, but not a changed identity/policy or explicit service denial.');
