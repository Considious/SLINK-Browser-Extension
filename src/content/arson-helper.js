(function installArsonHelper(global){
  'use strict';
  const S=global.SLINK_EXTENSION,activity=S.core.pageActivity;
  const toggle='crimes.arson.enabled',sessionKey='access.session.v1';
  let allowed=false,generation=0,expiresAt=0;
  const helper=S.core.arsonPage.connect({
    eligible:()=>allowed&&expiresAt>Date.now()&&activity.eligible(),
    journal:{candidates:(_crime,key)=>S.core.messaging.send('crimes.recipes.candidates',{key}),record:(_crime,key,steps)=>S.core.messaging.send('crimes.recipes.record',{key,steps})}
  });
  async function sync(){
    const rev=++generation;
    try{
      const [enabled,session]=await Promise.all([S.core.storage.get(toggle,false),S.core.storage.get(sessionKey,null)]);
      if(rev!==generation)return;
      expiresAt=Number(session?.expiresAt)||0;
      allowed=enabled===true&&S.core.permissions.hasScope(session||{},'slink.adhd.alerts');
      helper.setEnabled(allowed);
    }catch{if(rev===generation){allowed=false;helper.setEnabled(false);}}
  }
  activity.subscribe(()=>{helper.sync();if(activity.eligible())void sync();});
  chrome.storage.onChanged.addListener((changes,area)=>{if(area==='local'&&[toggle,sessionKey].some(key=>changes[S.STORAGE_PREFIX+key]))void sync();});
  void sync();
})(globalThis);
