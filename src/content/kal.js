(function startKal(global) {
  'use strict';
  if(global.location.pathname!=='/profiles.php')return;
  const send=(type,payload)=>global.SLINK_EXTENSION.core.messaging.send('kal.'+type,payload);
  const client={status:()=>send('status'),load:(playerId,cursor)=>send('load',{playerId,cursor})};
  const panel=global.SLINK_KAL_UI.mountPage({client});
  const themeHost=document.getElementById('slink-extension-panel');
  if(themeHost&&panel){const theme=()=>{const css=getComputedStyle(themeHost);for(const key of ['--slink-panel-bg','--slink-text','--slink-border'])panel.root.style.setProperty(key,css.getPropertyValue(key));};new MutationObserver(theme).observe(themeHost,{attributes:true,attributeFilter:['data-slink-theme','style']});theme();}
  chrome.storage.onChanged.addListener((changes,area)=>{if(area==='local'&&Object.keys(changes).some(key=>key.startsWith('slink.kal.')))void panel?.refresh().catch(()=>{});});
})(globalThis);
