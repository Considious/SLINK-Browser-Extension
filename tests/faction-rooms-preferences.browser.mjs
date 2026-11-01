import assert from 'node:assert/strict';
import {pathToFileURL,fileURLToPath} from 'node:url';
const {chromium}=await import(process.env.SLINK_BROWSER_PACKAGE?pathToFileURL(process.env.SLINK_BROWSER_PACKAGE).href:'playwright');
const browser=await chromium.launch({headless:true,executablePath:process.env.SLINK_BROWSER_EXECUTABLE||'C:/Program Files/Google/Chrome/Application/chrome.exe'});
try{
 const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.setContent('<div id="settings"></div>');
 for(const name of ['client','ui','settings'])await page.addScriptTag({path:fileURLToPath(new URL('../src/core/faction-node-'+name+'.js',import.meta.url))});
 await page.evaluate(async()=>{
  window.settings={soundEnabled:false};window.refreshes=0;window.accept=false;window.confirmText=[];
  window.confirm=text=>{confirmText.push(text);return accept;};window.states=new Map();
  const preferences={get:async()=>({...settings}),patch:async input=>{settings=SLINK_FACTION_NODE.patchRoomSettings(settings,input);return settings;}};
  window.client={model:{status:'idle',rooms:[{room_id:'general',name:'General',visibility:'faction'},{room_id:'officers',name:'Officers',visibility:'selected'}],leader:true,userId:1,factionId:10},
   setActive(){},dispose(){},subscribe:()=>()=>{},members:async()=>({members:[{user_id:1,user_name:'Considious'}]}),
   room(id){if(!states.has(id))states.set(id,{unread:0,messages:new Map(),pending:new Map(),presence:[]});return states.get(id);},
   async refresh(){refreshes++;this.model.status='ready';},
   api:async()=>({rooms:[{room_id:'general',name:'General',description:'Faction coordination',visibility:'faction',members:[]}],leaders:[1]})};
  window.controller=await SLINK_FACTION_NODE_SETTINGS(document.getElementById('settings'),{...preferences,createManager:container=>SLINK_FACTION_NODE_UI.mount({client,container,preferences,activity:{eligible:()=>true,subscribe:()=>()=>{}}})});
 });
 assert.equal(await page.locator('[data-node-enabled]').isChecked(),true);
 assert.equal(await page.locator('[data-node-sound]').isEnabled(),true);
 assert.equal(await page.locator('[data-node-sound]').isChecked(),false,'Saved master sound must be loaded, not just enabled');
 await page.locator('[data-node-sound]').check();await page.waitForFunction(()=>settings.soundEnabled===true);
 await page.locator('[data-node-open]').click();assert.equal(await page.evaluate(()=>refreshes),0,'Declining the notice must not request room data');
 assert.match(await page.evaluate(()=>confirmText[0]),/not managed or endorsed by Torn/);
 await page.evaluate(()=>accept=true);await page.locator('[data-node-open]').click();await page.waitForFunction(()=>refreshes===1);
 assert.equal(await page.evaluate(()=>settings.noticeAccepted),'third-party-rooms-v1');
 const general=page.locator('[data-room-sound-id="general"]'),officers=page.locator('[data-room-sound-id="officers"]');
 await general.uncheck();await page.waitForFunction(()=>settings.roomSounds.general===false);assert.equal(await officers.isChecked(),true,'Muting one room cannot mute another');
 assert.equal(await page.locator('[data-embedded]').evaluate(el=>getComputedStyle(el).position),'relative','Dashboard management must be in the module, not a floating Torn window');
 assert.equal(await page.locator('#slink-faction-node-button').count(),0);
 await page.locator('[data-node-manage]').click();assert.equal(await page.locator('[data-name]').inputValue(),'General');assert.match(await page.locator('[data-leaders]').textContent(),/Considious/);
 await page.evaluate(()=>client.model.leader=false);await page.locator('[data-node-manage]').click();assert.match(await page.locator('[data-node-save]').textContent(),/Only explicitly assigned Chat Leaders/);
 await page.evaluate(()=>controller.stop());assert.equal(await page.locator('[data-slink-faction-node]').count(),0);assert.deepEqual(errors,[]);
 console.log('Settings initialization, automatic saves, default-enabled disclosure gate, per-room mute isolation, embedded dashboard management and Leader restriction passed.');
}finally{await browser.close();}
