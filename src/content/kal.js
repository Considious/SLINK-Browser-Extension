(function startKal(global) {
  'use strict';
  if(global.location.pathname!=='/profiles.php')return;
  const send=(type,payload)=>global.SLINK_EXTENSION.core.messaging.send('kal.'+type,payload);
  const client={status:()=>send('status'),load:(playerId,cursor)=>send('load',{playerId,cursor})};
  const panel=global.SLINK_KAL_UI.mountPage({client});
  // Mirror the active SLINK theme onto the external profile panel, including seasonal palette tokens.
  if(panel){
    let themeHost=null,themeObserver=null;
    const properties=['--slink-panel-bg','--slink-surface','--slink-text','--slink-border','--slink-accent','--slink-muted'];
    const syncTheme=()=>{
      const host=themeHost||document.getElementById('slink-extension-panel');
      if(!host)return;
      const css=getComputedStyle(host);
      for(const key of properties){const value=css.getPropertyValue(key).trim();if(value)panel.root.style.setProperty(key,value);else panel.root.style.removeProperty(key);}
    };
    const attach=()=>{
      const host=document.getElementById('slink-extension-panel');
      if(!host||host===themeHost)return;
      themeObserver?.disconnect();themeHost=host;
      themeObserver=new MutationObserver(syncTheme);
      themeObserver.observe(host,{attributes:true,attributeFilter:['data-slink-theme','data-theme','class','style']});
      syncTheme();
    };
    attach();
    if(!themeHost){
      const ready=new MutationObserver(()=>{if(document.getElementById('slink-extension-panel')){attach();ready.disconnect();}});
      ready.observe(document.body,{childList:true,subtree:true});
    }
    const modeObserver=new MutationObserver(syncTheme);
    modeObserver.observe(document.documentElement,{attributes:true,attributeFilter:['class','style','data-slink-theme','data-theme']});
  }
  chrome.storage.onChanged.addListener((changes,area)=>{if(area==='local'&&Object.keys(changes).some(key=>key.startsWith('slink.kal.')))void panel?.refresh().catch(()=>{});});
})(globalThis);
