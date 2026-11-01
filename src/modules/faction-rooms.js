(function registerFactionRooms(global){
  'use strict';const SLINK=global.SLINK_EXTENSION;
  SLINK.modules.register({id:'faction-rooms',title:'Faction Rooms',shortTitle:'Faction Rooms',group:'quality-of-life',groupTitle:'Quality of Life',requiredScopes:['slink.chat'],defaultShowInTorn:true,matches:url=>url.hostname==='www.torn.com',
    async start({ui}){return global.SLINK_FACTION_NODE_SETTINGS(ui.getContentElement(),{get:()=>SLINK.core.messaging.send('factionNode.settings.get'),patch:changes=>SLINK.core.messaging.send('factionNode.settings.patch',changes)});}
  });
})(globalThis);
