import assert from 'node:assert/strict';
import {readFile,mkdir} from 'node:fs/promises';
import {fileURLToPath,pathToFileURL} from 'node:url';
const packagePath=process.env.SLINK_BROWSER_PACKAGE;
const {chromium}=await import(packagePath?pathToFileURL(packagePath).href:'playwright');
const browser=await chromium.launch({headless:true,...(process.env.SLINK_BROWSER_EXECUTABLE?{executablePath:process.env.SLINK_BROWSER_EXECUTABLE}:{})});
try{
  const page=await browser.newPage({viewport:{width:390,height:844}});await page.setContent('<style>body{background:#26262e;color:white}.row{position:fixed;bottom:0;right:0;display:flex;height:34px;gap:4px}.row button{width:38px;background:#222;color:white;border:1px solid #666}</style><div id="chatRoot"><div class="row"><button id="people_panel_button" title="People">P</button><button id="slink_extension_chat_button">SL</button><button id="notes_settings_button" title="Settings">S</button></div></div>');
  await page.addScriptTag({path:fileURLToPath(new URL('../src/core/faction-node-ui.js',import.meta.url))});
  await page.evaluate(()=>{
    let active=true;const subscribers=new Set(),listeners=new Set(),states=new Map();window.calls=[];
    const admin={leaders:[1],rooms:[{room_id:'general',name:'General',description:'',visibility:'faction',members:[],links:[]}]};
    const client={model:{status:'ready',rooms:[{room_id:'general',name:'General',visibility:'faction'}],leader:true,userId:1,factionId:10},room(id){if(!states.has(id))states.set(id,{messages:new Map(),pending:new Map(),access:{read:true,speak:true,moderate:true},status:'connected',unread:0,presence:[]});return states.get(id);},subscribe(fn){listeners.add(fn);return()=>listeners.delete(fn);},setActive(){},async refresh(){for(const fn of listeners)fn({type:'list'});},async connect(){},send(){},command(){},async action(){},async older(){},dispose(){},members:async()=>({members:[{user_id:1,user_name:'Leader'},{user_id:2,user_name:'Member A'}]}),async api(path,payload){calls.push({path,payload});if(payload?.action==='member.set'){const room=admin.rooms[0],entry=room.members.find(member=>member.user_id===payload.user_id);if(entry)Object.assign(entry,payload);else room.members.push({...payload});}return admin;}};
    window.client=client;window.emit=(type='room')=>{for(const fn of listeners)fn({type,id:'general'});};window.active=value=>{active=value;for(const fn of subscribers)fn(value);};
    window.ui=SLINK_FACTION_NODE_UI.mount({client,activity:{eligible:()=>active,subscribe(fn){subscribers.add(fn);return()=>subscribers.delete(fn);}},theme:()=>({'--slink-accent':'#a72cff','--slink-text':'#fff'})});
  });
  await page.locator('#slink-faction-node-button').click();await page.locator('[data-rooms] button').click();
  assert.equal(await page.locator('[data-slink-faction-node]').isVisible(),true);
  const box=await page.locator('[data-slink-faction-node]').boundingBox();assert.ok(box.x>=0&&box.x+box.width<=390&&box.y>=0&&box.y+box.height<=844,JSON.stringify(box));
  await page.locator('[data-draft]').fill('My unsent draft');await page.locator('[data-draft]').focus();
  await page.evaluate(()=>{window.originalDraft=document.querySelector('[data-slink-faction-node]').shadowRoot.querySelector('[data-draft]');client.room('general').messages.set('message-1',{message_id:'message-1',seq:1,revision:1,user_id:2,display_name:'<img src=x onerror=alert(1)>',origin_faction_id:10,created_at:Date.now(),content:{type:'text',text:'<script>window.injected=true</script>'}});emit();});
  assert.equal(await page.locator('[data-draft]').inputValue(),'My unsent draft');assert.equal(await page.evaluate(()=>document.querySelector('[data-slink-faction-node]').shadowRoot.activeElement===window.originalDraft),true);assert.equal(await page.locator('[data-messages] script').count(),0);assert.equal(await page.locator('[data-messages] img').count(),0);
  await page.locator('[data-close]').click();await page.locator('#slink-faction-node-button').click();assert.equal(await page.locator('[data-chat-view]').isVisible(),true);assert.equal(await page.locator('[data-draft]').inputValue(),'My unsent draft');
  await page.evaluate(()=>{client.room('general').access.speak=false;emit();});assert.equal(await page.locator('[data-send]').isDisabled(),true);assert.equal(await page.locator('[data-draft]').inputValue(),'My unsent draft');
  await page.evaluate(()=>{active(false);client.room('general').messages.set('message-2',{message_id:'message-2',seq:2,revision:1,user_id:2,display_name:'Member A',origin_faction_id:10,created_at:Date.now(),content:{type:'text',text:'While paused'}});emit();});assert.equal(await page.locator('[data-messages] li').count(),1);await page.evaluate(()=>active(true));assert.equal(await page.locator('[data-messages] li').count(),2);
  if(process.env.SLINK_SCREENSHOT_DIR){await mkdir(process.env.SLINK_SCREENSHOT_DIR,{recursive:true});await page.screenshot({path:process.env.SLINK_SCREENSHOT_DIR+'/faction-rooms-mobile.png'});}
  await page.locator('[data-admin]').click();await page.locator('[data-member]').fill('Member A [2]');await page.locator('[data-name]').fill('Unfinished room name');await page.locator('[data-can-speak]').uncheck();
  await page.waitForFunction(()=>calls.some(call=>call.payload?.action==='member.set'));
  const change=await page.evaluate(()=>calls.find(call=>call.payload?.action==='member.set').payload);assert.equal(change.can_speak,false);assert.equal('can_read' in change,false);assert.equal('role' in change,false);
  assert.equal(await page.locator('[data-name]').inputValue(),'Unfinished room name');
  const adminScroll=page.locator('[data-admin-view] .scroll');await adminScroll.hover();await page.mouse.wheel(0,450);await page.waitForFunction(()=>document.querySelector('[data-slink-faction-node]').shadowRoot.querySelector('[data-admin-view] .scroll').scrollTop>0);
  await page.setViewportSize({width:1100,height:780});await page.evaluate(()=>window.dispatchEvent(new Event('resize')));const wide=await page.locator('[data-slink-faction-node]').boundingBox();assert.ok(wide.width<=390);assert.equal(await page.locator('#notes_settings_button').isVisible(),true);
  if(process.env.SLINK_SCREENSHOT_DIR)await page.screenshot({path:process.env.SLINK_SCREENSHOT_DIR+'/faction-rooms-admin.png'});
  await page.evaluate(()=>{ui.dispose();window.restoreSaved=null;window.ui=SLINK_FACTION_NODE_UI.mount({client,activity:{eligible:()=>true,subscribe:()=>()=>{}},view:{get:async()=>({visible:true,view:'chat',userId:1,factionId:10,roomId:'general'}),save:async value=>{restoreSaved=value;}}});});
  await page.locator('[data-chat-view]').waitFor({state:'visible'});assert.equal(await page.locator('[data-room-title]').textContent(),'General');
  await page.evaluate(()=>{client.room('general').access.speak=true;emit();window.mediaOpens=0;window.SLINK_GIPHY_PANEL=()=>({host:document.createElement('div'),open:async()=>{mediaOpens++;},suspend(){},stop(){}});});
  await page.locator('[data-gifs]').click();await page.locator('[data-close]').click();await page.locator('#slink-faction-node-button').click();assert.equal(await page.locator('[data-media-view]').isVisible(),true);assert.equal(await page.evaluate(()=>mediaOpens),2);
  await page.locator('[data-close]').click();await page.waitForFunction(()=>restoreSaved?.visible===false);
  await page.evaluate(()=>ui.dispose());assert.equal(await page.locator('#slink-faction-node-button').count(),0);assert.equal(await page.locator('#people_panel_button').count(),1);
  console.log('Faction room browser checks passed: chat-row placement, mobile bounds, retained focused draft, text safety, mute, activity, independent permissions and native controls.');
}finally{await browser.close();}
