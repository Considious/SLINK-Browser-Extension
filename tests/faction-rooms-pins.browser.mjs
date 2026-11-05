import assert from 'node:assert/strict';
import {pathToFileURL,fileURLToPath} from 'node:url';
const {chromium}=await import(process.env.SLINK_BROWSER_PACKAGE?pathToFileURL(process.env.SLINK_BROWSER_PACKAGE).href:'playwright');
const browser=await chromium.launch({headless:true,executablePath:process.env.SLINK_BROWSER_EXECUTABLE||'C:/Program Files/Google/Chrome/Application/chrome.exe'});
try{
 const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.setContent('<div id="chatRoot"><div style="position:fixed;bottom:0;right:0;display:flex"><button id="people_panel_button">People</button></div></div>');
 for(const name of ['client','ui'])await page.addScriptTag({path:fileURLToPath(new URL('../src/core/faction-node-'+name+'.js',import.meta.url))});
 await page.evaluate(()=>{
  window.saved={noticeAccepted:SLINK_FACTION_NODE.ROOM_NOTICE};
  window.opens=[];
  window.state={unread:3,access:{read:true,speak:true},messages:new Map(),pending:new Map(),status:'connected'};
  const client={model:{rooms:[{room_id:'general',name:'Alliance',visibility:'faction'}],status:'ready',userId:1,factionId:2},room:()=>state,setActive(){},setViewedRoom(){},dispose(){},subscribe(fn){window.emit=fn;return()=>{};},async refresh(){},async connect(id){opens.push(id);},command(){}};
  window.testClient=client;
  window.roomsUi=SLINK_FACTION_NODE_UI.mount({client,activity:{eligible:()=>true,subscribe:()=>()=>{}},preferences:{get:async()=>saved,patch:async change=>saved=SLINK_FACTION_NODE.patchRoomSettings(saved,change)}});
 });
 await page.locator('#slink-faction-node-button').click();
 await page.getByText('Personal rooms · 0/0 rooms available.',{exact:false}).waitFor();
 assert(await page.getByRole('button',{name:'Create personal room'}).isDisabled());
 await page.getByRole('button',{name:'Pin',exact:true}).click();
 const pin=page.locator('[data-slink-room-pins] button');
 await pin.waitFor();assert.equal(await pin.getAttribute('aria-label'),'Alliance, 3 unread');
 assert.equal(await page.evaluate(()=>opens.length),0);
 await page.getByLabel('color for Alliance').selectOption('#20516d');
 await page.waitForFunction(()=>saved.pins[0].color==='#20516d');
 await pin.click();assert.deepEqual(await page.evaluate(()=>opens),['general']);
 assert.equal(await pin.getAttribute('aria-pressed'),'true');
 assert.equal(await page.locator('[data-window-title]').textContent(),'Alliance');
 assert.equal(await page.locator('[data-send] svg').count(),1);
 assert.equal(await page.locator('#slink-faction-node-button svg').count(),1);
 const message=(id,seq)=>({message_id:id,seq,revision:1,user_id:2,created_at:Date.now(),content:{type:'text',text:id}});
 for(const [id,seq] of [['first',1],['second',2]])await page.evaluate(value=>{state.messages.set(value.message_id,value);emit({type:'room',id:'general',message:value});},message(id,seq));
 assert.equal(await page.locator('[data-messages] [data-message-id]').count(),2);
 await page.evaluate(()=>{
  if(!crypto.randomUUID)crypto.randomUUID=()=> 'fixture-request-id';
  testClient.model.personal={used:0,limit:1,rooms:[]};
  testClient.api=async (path,input)=>{window.personalCall={path,input};testClient.model.personal={used:1,limit:1,rooms:[{room_id:'mine',name:input.name,description:'',members:[]}]};};
  testClient.refresh=async()=>emit({type:'list'});
 });
 await page.getByRole('button',{name:'Room list',exact:true}).click();
 await page.locator('[data-personal-rooms] summary').filter({hasText:'Create personal room'}).click();
 await page.getByLabel('Room name').fill('My group');
 await page.getByRole('button',{name:'Create personal room'}).click();
 await page.getByText('Manage My group',{exact:true}).waitFor();
 const call=await page.evaluate(()=>personalCall);assert.equal(call.path,'/api/personal-rooms');assert.equal(call.input.action,'create');assert.equal(call.input.name,'My group');assert.ok(call.input.request_id);
 assert(await page.getByRole('button',{name:'Create personal room'}).isDisabled());
 await page.evaluate(()=>roomsUi.dispose());assert.equal(await pin.count(),0);assert.deepEqual(errors,[]);
 console.log('Room pins, saved colors, unread, no extra connection, message append and disabled personal rooms passed.');
}finally{await browser.close();}
