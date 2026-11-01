(function installFactionRooms(global){
  'use strict';
  const SLINK=global.SLINK_EXTENSION,KEY='factionNode.settings.v1';let ui=null,loading=0;
  function theme(){const host=document.getElementById('slink-extension-panel');if(!host)return {};const style=getComputedStyle(host),out={};for(let index=0;index<style.length;index++){const key=style[index];if(key.startsWith('--slink-')){const value=style.getPropertyValue(key).trim();if(value)out[key]=value;}}out['--slink-panel']=out['--slink-panel-bg']||out['--slink-bg'];return out;}
  async function sync(){const current=++loading;try{const settings=await SLINK.core.storage.get(KEY,{enabled:false});if(current!==loading)return;if(!settings.enabled){ui?.dispose();ui=null;return;}if(ui){ui.sync();return;}const client=global.SLINK_FACTION_NODE.create({ticket:force=>SLINK.core.messaging.send('factionNode.ticket',{force}),members:()=>SLINK.core.messaging.send('factionNode.members')});ui=global.SLINK_FACTION_NODE_UI.mount({client,activity:SLINK.core.pageActivity,theme,view:{get:()=>SLINK.core.messaging.send('factionNode.view.get'),save:record=>SLINK.core.messaging.send('factionNode.view.save',record)}});}catch{ /* Optional chat must never prevent the existing SLINK runtime from starting. */ }}
  chrome.storage.onChanged.addListener((changes,area)=>{if(area==='local'&&changes[SLINK.STORAGE_PREFIX+KEY])void sync();});
  void sync();
})(globalThis);
