(function installFactionNodeService(global){
  'use strict';
  const SLINK=global.SLINK_EXTENSION,BASE='https://slinkcontributionworker.richard-johnson554.workers.dev',KEY='factionNode.settings.v1';
  let loading=null,patchQueue=Promise.resolve(),viewQueue=Promise.resolve();
  async function central(path,force=false,retry=true){
    const session=await SLINK.services.permissionAccess.ensureSession(force,'slink.chat');
    try{return await SLINK.core.http.requestJson('contributionWorker',BASE+'/api/chat/'+path,{method:path==='token'?'POST':'GET',headers:{Authorization:'Bearer '+session.token,'Content-Type':'application/json'},...(path==='token'?{body:'{}'}:{})});}
    catch(error){if(retry&&[401,428].includes(Number(error.status)))return central(path,true,false);throw error;}
  }
  const routes={
    'factionNode.view.get':async()=>{await viewQueue.catch(()=>{});return SLINK.core.storage.get('ui.factionNodeView.v1',{});},
    'factionNode.view.save':input=>{const task=viewQueue.catch(()=>{}).then(async()=>{if(typeof input.visible!=='boolean'||!['home','chat','admin'].includes(input.view)||!Number.isSafeInteger(input.userId)||input.userId<=0||!Number.isSafeInteger(input.factionId)||input.factionId<=0||input.roomId!==null&&!/^[A-Za-z0-9_-]{1,100}$/.test(input.roomId))throw Error('Invalid faction room view.');return SLINK.core.storage.set('ui.factionNodeView.v1',{visible:input.visible,view:input.view,userId:input.userId,factionId:input.factionId,roomId:input.roomId});});viewQueue=task;return task;},
    'factionNode.settings.get':()=>SLINK.core.storage.get(KEY,{enabled:false}),
    'factionNode.settings.patch':input=>{const task=patchQueue.catch(()=>{}).then(async()=>{if(typeof input.enabled!=='boolean'||Object.keys(input).some(key=>key!=='enabled'))throw Error('Choose whether to show faction rooms.');return SLINK.core.storage.set(KEY,{enabled:input.enabled});});patchQueue=task;return task;},
    'factionNode.ticket':async input=>{if(loading)return loading;loading=central('token',input.force===true);try{return await loading;}finally{loading=null;}},
    'factionNode.members':()=>central('members')
  };
  SLINK.define('services','factionNode',Object.freeze({routes}));
})(globalThis);
