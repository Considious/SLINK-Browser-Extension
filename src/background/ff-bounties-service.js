(function(g){
 'use strict';
 const S=g.SLINK_EXTENSION;
 async function getKey(){
  const session=await S.core.storage.get('access.session.v1',null);
  if(!session||Number(session.expiresAt)<=Date.now()||!S.core.permissions.hasScope(session,'slink.combat.bounties'))return '';
  for(const name of ['bounties.settings.v1','access.settings.v1','leveling.settings.v1','war.settings.v1','mugging.settings.v1']){
   const value=await S.core.storage.get(name,{});
   if(typeof value?.ffKey==='string'&&value.ffKey.trim())return value.ffKey;
  }
  return '';
 }
 const run=g.SLINK_FF_BOUNTIES.service({getKey,async request(url,body){
  const response=await fetch(url,{method:body?'POST':'GET',headers:{Accept:'application/json',...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined,redirect:'error',cache:'no-store',credentials:'omit',referrerPolicy:'no-referrer',signal:AbortSignal.timeout(12000)});
  let data;try{data=await response.json();}catch{throw {status:response.status};}
  if(!response.ok)throw {status:response.status,body:data};
  return data;
 }});
 S.define('services','ffBounties',Object.freeze({routes:Object.freeze({
  'ffBounties.run':({action}={})=>run(action)
 })}));
})(globalThis);
