(function installFactionNodeService(global){
  'use strict';
  const SLINK=global.SLINK_EXTENSION,KEY='factionNode.settings.v1';
  let loading=null,patchQueue=Promise.resolve(),viewQueue=Promise.resolve();
  const access=global.SLINK_FACTION_NODE.createTestAccess({
    async context(){const [settings,primary,leveling,war,...accepted]=await Promise.all([SLINK.core.storage.get(KEY,{}),SLINK.core.storage.get('access.settings.v1',{}),SLINK.core.storage.get('leveling.settings.v1',{}),SLINK.core.storage.get('war.settings.v1',{}),SLINK.core.storage.get('access.acceptedTerms.v1',null),SLINK.core.storage.get('leveling.acceptedTerms.v1',null),SLINK.core.storage.get('war.acceptedTerms.v1',null)]);return {enabled:settings.noticeAccepted===global.SLINK_FACTION_NODE.ROOM_NOTICE,key:String(primary.tornKey||'').trim()||String(leveling.tornKey||'').trim()||String(war.tornKey||'').trim(),accepted};},
    reserve:()=>SLINK.core.tornApiLimiter.reserve({wait:true}),
    request:(url,options={})=>SLINK.core.http.requestJson('factionChatTest',url,{...options,...(options.body?{body:JSON.stringify(options.body)}:{})})
  });
  const routes={
    'factionNode.view.get':async()=>{await viewQueue.catch(()=>{});return SLINK.core.storage.get('ui.factionNodeView.v1',{});},
    'factionNode.view.save':input=>{const task=viewQueue.catch(()=>{}).then(async()=>{if(typeof input.visible!=='boolean'||!['home','chat','admin'].includes(input.view)||!Number.isSafeInteger(input.userId)||input.userId<=0||!Number.isSafeInteger(input.factionId)||input.factionId<=0||input.roomId!==null&&!/^[A-Za-z0-9_-]{1,100}$/.test(input.roomId))throw Error('Invalid faction room view.');return SLINK.core.storage.set('ui.factionNodeView.v1',{visible:input.visible,view:input.view,userId:input.userId,factionId:input.factionId,roomId:input.roomId});});viewQueue=task;return task;},
    'factionNode.settings.get':async()=>global.SLINK_FACTION_NODE.roomSettings(await SLINK.core.storage.get(KEY,{})),
    'factionNode.settings.patch':input=>{const task=patchQueue.catch(()=>{}).then(async()=>{const current=await SLINK.core.storage.get(KEY,{});const saved=await SLINK.core.storage.set(KEY,global.SLINK_FACTION_NODE.patchRoomSettings(current,input));if(!saved.enabled)access.clear();return saved;});patchQueue=task;return task;},
    'factionNode.ticket':async input=>{if(loading)return loading;loading=access.central('token',input.force===true);try{return await loading;}finally{loading=null;}},
    'factionNode.members':()=>access.central('members')
  };
  SLINK.define('services','factionNode',Object.freeze({routes}));
})(globalThis);
