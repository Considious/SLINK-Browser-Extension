(function connectChatFairFight(global){
 'use strict';const S=global.SLINK_EXTENSION;let permitted=false,enabled=false,generation=0;
 const bubbles=global.SLINK_CHAT_FF.mount({activity:S.core.pageActivity,enabled:()=>permitted&&enabled,lookup:ids=>S.core.messaging.send('chat.ff.lookup',{ids})});
 async function refresh(){const token=++generation;try{const config=await S.core.messaging.send('chat.ff.get');if(token!==generation)return;enabled=config.enabled===true;permitted=enabled;}catch{if(token!==generation)return;enabled=false;}bubbles.sync();}
 global.addEventListener('slink-chat-enable',()=>{permitted=true;void refresh();});
 global.addEventListener('slink-chat-disable',()=>{permitted=false;generation++;bubbles.sync();});
 chrome.storage.onChanged.addListener((changes,area)=>{if(area==='local'&&Object.keys(changes).some(key=>key.includes('qol.chat.ff.v1')||key.includes('access.session.v1')))void refresh();});
 void refresh();
})(globalThis);
