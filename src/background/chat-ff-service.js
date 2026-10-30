(function installChatFairFightService(global){
 'use strict';const S=global.SLINK_EXTENSION,KEY='qol.chat.ff.v1';let queue=Promise.resolve();
 async function access(){const session=await S.core.storage.get('access.session.v1',null);return session&&Number(session.expiresAt)>Date.now()&&S.core.permissions.hasScope(session,'slink.qol.chat')?session:null;}
 async function state(){
  const session=await access(),settings=await S.core.storage.get(KEY,{});if(!session||settings.enabled!==true)return {allowed:false};
  const providers=await S.core.storage.get('shared.providers.v1',{}),own=Object.values(providers.personal||{}).filter(r=>Number(r.accountId)===Number(session.userId)&&r.source==='torn-v2-authenticated-battlestats').sort((a,b)=>b.statsAt-a.statsAt)[0];
  let key='';for(const name of ['access.settings.v1','war.settings.v1','leveling.settings.v1','bounties.settings.v1','mugging.settings.v1']){const row=await S.core.storage.get(name,{});if(row.ffKey){key=String(row.ffKey).trim();break;}}
  return {allowed:true,key,context:{observerId:session.userId,ownStatsAt:own?.statsAt||0}};
 }
 const lookup=global.SLINK_CHAT_FF.createLookup({state,request:(ids,key)=>S.core.http.requestJson('ffscouter','https://ffscouter.com/api/v1/get-stats?key='+encodeURIComponent(key)+'&targets='+ids.join(','),{cache:'no-store'}),intelligence:async id=>(await S.services.playerIntelligence.get({playerId:id})).record,backup:ids=>S.services.ffBackup.engine.fallback(ids)});
 S.define('services','chatFairFight',Object.freeze({routes:Object.freeze({
  async 'chat.ff.get'(){return {enabled:!!await access()&&(await S.core.storage.get(KEY,{})).enabled===true};},
  'chat.ff.patch'(input){const value=input?.enabled===true;const task=queue.catch(()=>{}).then(async()=>{if(!await access())throw Error('Current Chat access is required.');const old=await S.core.storage.get(KEY,{});await S.core.storage.set(KEY,{...old,enabled:value});return {enabled:value};});queue=task;return task;},
  async 'chat.ff.lookup'(input,sender){if(!sender?.tab?.active||!Array.isArray(input?.ids)||input.ids.length>200)return [];return lookup(input.ids);}
 })}));
})(globalThis);
