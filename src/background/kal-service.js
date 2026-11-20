(function installKalService(global) {
  'use strict';
  const S=global.SLINK_EXTENSION,key=name=>'slink.kal.'+name+'.v1';
  const client=global.SLINK_KAL.create({
    storage:{get:async name=>(await chrome.storage.local.get(key(name)))[key(name)],set:async(name,value)=>chrome.storage.local.set({[key(name)]:value}),remove:async name=>chrome.storage.local.remove(key(name))},
    cache:global.SLINK_KAL.openCache(),
    request:async(url,options)=>{const target=new URL(url);if(options.method!=='GET'||target.origin!==global.SLINK_KAL.ORIGIN)throw new Error('KAL supports read requests only.');const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),12_000);try{const r=await fetch(url,{...options,signal:controller.signal});return{status:r.status,text:await r.text(),retryAfter:r.headers.get('retry-after')};}finally{clearTimeout(timer);}}
  });
  function settingsOnly(sender){if(!sender?.url?.startsWith(chrome.runtime.getURL('src/dashboard/')))throw new Error('Open SLINK settings to manage KAL credentials.');}
  S.define('services','kal',Object.freeze({routes:{
    'kal.status':()=>client.status(),
    'kal.load':({playerId,cursor},sender)=>{const url=new URL(sender?.url||'about:blank');if(url.origin!=='https://www.torn.com'||url.pathname!=='/profiles.php'||Number(url.searchParams.get('XID'))!==Number(playerId))throw new Error('KAL equipment is available only on the selected player profile.');return client.load(playerId,cursor??null);},
    'kal.connect':(payload,sender)=>{settingsOnly(sender);return client.connect(payload.key,payload.consent);},
    'kal.configure':(payload,sender)=>{settingsOnly(sender);return client.configure(payload);},
    'kal.disconnect':(_payload,sender)=>{settingsOnly(sender);return client.disconnect();}
  }}));
})(globalThis);
