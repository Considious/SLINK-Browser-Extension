(function installFfBackupService(global){
 'use strict';const SLINK=global.SLINK_EXTENSION;
 const BASE='https://slinkcontributionworker.richard-johnson554.workers.dev/api/fair-fight/backup/';
 const store=global.SLINK_FF_BACKUP.openStore();
 const engine=global.SLINK_FF_BACKUP.create({store,
  // Reuse existing sessions only. Backup work must never initiate Torn authentication/API calls.
  session:async()=>{const s=await SLINK.core.storage.get('access.session.v1',null);return s?.token&&Number(s.expiresAt)>Date.now()?s:null;},
  ownScore:async()=>{const shared=await SLINK.core.storage.get('shared.providers.v1',{}),s=await SLINK.core.storage.get('access.session.v1',null);const rows=Object.values(shared.personal||{}).filter(r=>Number(r.accountId)===Number(s?.userId)&&r.source==='torn-v2-authenticated-battlestats').sort((a,b)=>b.statsAt-a.statsAt);return rows[0]?.score||null;},
  transport:async(action,body,token)=>{const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),4000);try{return await SLINK.core.http.requestJson('contributionWorker',BASE+action,{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify(body),signal:controller.signal,cache:'no-store'});}finally{clearTimeout(timer);}}
 });
 global.SLINK_FF_BACKUP_CLIENT=engine;
 SLINK.define('services','ffBackup',Object.freeze({engine,store}));
})(globalThis);
