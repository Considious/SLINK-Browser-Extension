import assert from 'node:assert/strict';
import {pathToFileURL,fileURLToPath} from 'node:url';
const {chromium}=await import(process.env.SLINK_BROWSER_PACKAGE?pathToFileURL(process.env.SLINK_BROWSER_PACKAGE).href:'playwright');
const browser=await chromium.launch({headless:true,executablePath:process.env.SLINK_BROWSER_EXECUTABLE||'C:/Program Files/Google/Chrome/Application/chrome.exe'});
try{
 const page=await browser.newPage({viewport:{width:1100,height:800}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.setContent('<div id="settings"></div><div id="consent"></div>');
 for(const name of ['client','ui','settings'])await page.addScriptTag({path:fileURLToPath(new URL('../src/core/faction-node-'+name+'.js',import.meta.url))});
 await page.evaluate(async()=>{
  window.settings={soundEnabled:false,noticeAccepted:SLINK_FACTION_NODE.ROOM_NOTICE};window.refreshes=0;window.accept=false;window.confirmText=[];window.calls=[];
  window.confirm=text=>{confirmText.push(text);return accept;};
  const preferences={get:async()=>({...settings}),patch:async input=>{settings=SLINK_FACTION_NODE.patchRoomSettings(settings,input);return settings;}};
  const room={room_id:'general',name:'General',description:'Faction coordination',visibility:'faction',members:[],links:[]};
  window.client={model:{status:'idle',rooms:[room],leader:true,userId:1,factionId:10},setActive(){},dispose(){},members:async()=>({members:[{user_id:1,user_name:'Considious'}]}),async refresh(){refreshes++;this.model.status='ready';},api:async(path,payload)=>{calls.push({path,payload});if(payload?.action==='room.update')Object.assign(room,payload);return {rooms:[room],leaders:[1]};}};
  window.controller=await SLINK_FACTION_NODE_SETTINGS(document.getElementById('settings'),{...preferences,createManager:container=>SLINK_FACTION_NODE_UI.mountAdmin({client,container,preferences})});
 });
 await page.locator('[data-admin-form]').waitFor({state:'visible'});
 assert.equal(await page.locator('[data-node-enabled]').isChecked(),true);assert.equal(await page.locator('[data-node-idle]').inputValue(),'0');await page.locator('[data-node-idle]').selectOption('15');await page.waitForFunction(()=>settings.idleMinutes===15);
 assert.equal(await page.locator('[data-node-sound],[data-room-sound],[data-node-open],[data-node-manage]').count(),0,'No duplicate chat sound controls or miniature-chat launchers in the GUI');
 assert.equal(await page.locator('[data-slink-faction-node],[data-draft],[data-messages]').count(),0,'GUI management must not create a chat window or composer');
 assert((await page.locator('[data-slink-room-management]').boundingBox()).width>900,'Management must use available dashboard width');
 assert.equal(await page.locator('[data-slink-room-management]').evaluate(el=>getComputedStyle(el).position),'static');
 assert.equal(await page.locator('[data-name]').inputValue(),'General');assert.match(await page.locator('[data-leaders]').textContent(),/Considious/);
 assert.equal(await page.locator('[data-node-media]').isChecked(),true);await page.locator('[data-node-media]').uncheck();await page.waitForFunction(()=>settings.autoMedia===false);assert.equal(await page.evaluate(()=>settings.soundEnabled),false);
 await page.locator('[data-node-enabled]').uncheck();await page.waitForFunction(()=>settings.enabled===false);assert.equal(await page.evaluate(()=>settings.soundEnabled),false,'Showing chat and its global sound preference remain separate saved values');
 await page.locator('[data-name]').fill('Updated room');await page.locator('[data-description]').fill('Officers coordinate here');await page.locator('[data-save-room]').click();await page.waitForFunction(()=>calls.some(c=>c.payload?.name==='Updated room'));
 await page.locator('[data-name]').fill('Unsent draft');await page.evaluate(()=>window.dispatchEvent(new Event('blur')));assert.equal(await page.locator('[data-name]').inputValue(),'Unsent draft');assert.equal(await page.locator('[data-admin-form]').isVisible(),true);
 await page.setViewportSize({width:390,height:844});assert((await page.locator('[data-slink-room-management]').boundingBox()).width<=390);assert.equal(await page.locator('[data-mute]').isVisible(),true);
 await page.evaluate(async()=>{window.noticeManager=SLINK_FACTION_NODE_UI.mountAdmin({container:document.getElementById('consent'),client,preferences:{get:async()=>({}),patch:async input=>Object.assign(settings,input)}});window.beforeConsent=refreshes;await noticeManager.open();});
 assert.equal(await page.evaluate(()=>refreshes),await page.evaluate(()=>beforeConsent),'Declining disclosure must not authenticate');assert.match(await page.evaluate(()=>confirmText[0]),/not managed or endorsed by Torn/);
 await page.evaluate(async()=>{accept=true;client.model.leader=false;await noticeManager.open();});assert.match(await page.locator('#consent [data-admin-notice]').textContent(),/Only explicitly assigned Chat Leaders/);assert.equal(await page.locator('#consent [data-admin-form]').isVisible(),false);
 await page.evaluate(()=>{noticeManager.dispose();controller.stop();});assert.equal(await page.locator('[data-slink-room-management]').count(),0);assert.deepEqual(errors,[]);
 console.log('Full-width standalone management, no embedded chat/sound duplicates, automatic preference save, shared server edits, focus retention, responsive forms, disclosure and Leader restriction passed.');
}finally{await browser.close();}
