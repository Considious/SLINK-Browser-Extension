(function(global){
  'use strict';const S=global.SLINK_EXTENSION;
  const controller=global.SLINK_QOL_UI.create({
    load:()=>S.core.messaging.send('qol.get'),save:value=>S.core.messaging.send('qol.save',value),cached:()=>S.core.messaging.send('qol.cached'),info:force=>S.core.messaging.send('qol.info',{force}),profile:force=>S.core.messaging.send('qol.profile',{force}),updates:()=>S.core.messaging.send('qol.updates'),product:'extension',version:S.VERSION
  });
  chrome.storage.onChanged.addListener((changes,area)=>{if(area==='local'&&Object.keys(changes).some(k=>k.startsWith('slink.qol.page-tools.v1:')||k==='slink.access.session.v1'))void controller.sync();});
  void controller.sync();
  S.modules.register({id:'page-tools',title:'Page tools',shortTitle:'Page tools',group:'quality-of-life',groupTitle:'Quality of Life',requiredScopes:['slink.adhd.alerts'],matches:url=>url.hostname==='www.torn.com',
    async start(context){controller.mount(context.ui.getContentElement(),(message,tone)=>context.ui.setStatus(message,tone));return {stop(){controller.unmount();}};}
  });
})(globalThis);
