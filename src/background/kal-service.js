(function installKalService(global) {
  'use strict';
  const S=global.SLINK_EXTENSION;
  const key=name=>'slink.kal.'+name+'.v1';
  const storage={get:async name=>(await chrome.storage.local.get(key(name)))[key(name)],set:async(name,value)=>chrome.storage.local.set({[key(name)]:value}),remove:async name=>chrome.storage.local.remove(key(name))};
  const request=async(url,options)=>{const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),12_000);try{const r=await fetch(url,{...options,signal:controller.signal});return{status:r.status,text:await r.text(),retryAfter:r.headers.get('retry-after')};}finally{clearTimeout(timer);}};
  const pending=global.SLINK_KAL.openCache(global.indexedDB,'slink-kal-pending');
  const collector=global.SLINK_KAL_CONTRIBUTIONS.create({
    store:{get:async()=>(await pending.get('queue'))?.value,set:async value=>pending.put({id:'queue',at:Date.now(),value})},
    auth:async()=>{const [c,s]=await Promise.all([storage.get('credentials'),storage.get('settings')]);return c?.schema===1?{...c,enabled:s?.enabled===true&&s.collectionEnabled===true}:null;},
    request,schedule:when=>chrome.alarms.create('slink.kal.retry',{when})
  });
  let lastCollectorFailure=null;
  const client=global.SLINK_KAL.create({
    storage,
    cache:global.SLINK_KAL.openCache(),
    request
  });
  // Keys are accepted only from extension-owned settings pages, never from Torn content.
  function settingsOnly(sender){if(!sender?.url?.startsWith(chrome.runtime.getURL('src/dashboard/')))throw new Error('Open SLINK settings to manage KAL credentials.');}
  S.define('services','kal',Object.freeze({drain:()=>collector.drain(),routes:{
    'kal.status':async()=>({...await client.status(),...await collector.status(),...lastCollectorFailure?{lastFailure:lastCollectorFailure}:{}}),
    'kal.observe':async(capture,sender)=>{const url=new URL(sender?.url||'about:blank');if(url.origin!=='https://www.torn.com'||url.pathname!=='/page.php'||url.searchParams.get('sid')!=='attack'||Number(url.searchParams.get('user2ID'))!==capture.target_id)throw new Error('KAL observation context rejected.');try{const result=await collector.enqueue(capture);lastCollectorFailure=null;return result;}catch(error){lastCollectorFailure='KAL could not persist this observation. Check local storage and retry on the next attack.';throw new Error(lastCollectorFailure);}},
    'kal.load':({playerId,cursor})=>client.load(playerId,cursor??null),
    'kal.connect':(payload,sender)=>{settingsOnly(sender);return client.connect(payload.key,payload.consent);},
    'kal.configure':async(payload,sender)=>{settingsOnly(sender);const state=await client.configure(payload);void collector.drain().catch(()=>{});return{...state,...await collector.status()};},
    'kal.disconnect':(_payload,sender)=>{settingsOnly(sender);return client.disconnect();}
  }}));
  void collector.drain().catch(()=>{});
})(globalThis);
