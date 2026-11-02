(function registerFactionRooms(global){
  'use strict';const SLINK=global.SLINK_EXTENSION;
  SLINK.modules.register({id:'faction-rooms',retainOnPause:true,title:'Faction Rooms',shortTitle:'Faction Rooms',group:'quality-of-life',groupTitle:'Quality of Life',requiredScopes:[],defaultShowInTorn:true,matches:url=>url.hostname==='www.torn.com',
    async start({ui}){const instance=await global.SLINK_FACTION_NODE_SETTINGS(ui.getContentElement(),{get:()=>SLINK.core.messaging.send('factionNode.settings.get'),patch:changes=>SLINK.core.messaging.send('factionNode.settings.patch',changes),createManager:container=>global.SLINK_FACTION_NODE_UI.mountAdmin({container,client:global.SLINK_FACTION_NODE.create({ticket:force=>SLINK.core.messaging.send('factionNode.ticket',{force}),members:refresh=>SLINK.core.messaging.send('factionNode.members',{refresh})}),activity:{eligible:()=>true,subscribe:()=>()=>{}},preferences:{get:()=>SLINK.core.messaging.send('factionNode.settings.get'),patch:record=>SLINK.core.messaging.send('factionNode.settings.patch',record)}})});ui.setStatus?.('');return instance;}
  });
})(globalThis);
