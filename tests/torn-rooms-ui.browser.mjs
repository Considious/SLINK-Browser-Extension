import assert from 'node:assert/strict';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {mkdir} from 'node:fs/promises';
const {chromium}=await import(pathToFileURL(process.env.SLINK_BROWSER_PACKAGE).href);
const browser=await chromium.launch({headless:true,executablePath:process.env.SLINK_BROWSER_EXECUTABLE});
const output=fileURLToPath(new URL('../../../../../output/torn-rooms-adaptation/',import.meta.url));await mkdir(output,{recursive:true});
try{for(const [platform,width]of [['extension',1550],['PDA',390]]){
 const page=await browser.newPage({viewport:{width,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(8000);
 await page.route('https://fixture.example.test/**',r=>r.fulfill({contentType:'text/html',body:'<!doctype html><body style="margin:0;background:#202124;color:#ddd"><div id="manager"></div><div id="chatRoot"><div style="position:fixed;right:0;bottom:0;height:38px;display:flex"><button id="people_panel_button" style="width:38px;height:38px">P</button><button id="notes_settings_button">S</button></div></div></body>'}));await page.goto('https://fixture.example.test/');
 for(const name of ['client','ui'])await page.addScriptTag({path:fileURLToPath(new URL(platform==='PDA'?'../../SLINK-PDA/src/addons/faction-node-'+name+'.js':'../src/core/faction-node-'+name+'.js',import.meta.url))});
 await page.evaluate(()=>{
  const callbacks=new Set(),states=new Map();window.calls=[];window.settings={noticeAccepted:SLINK_FACTION_NODE.ROOM_NOTICE};
  const general={room_id:'general',name:'Alliance HQ',description:'A place for alliance coordination',visibility:'faction',icon:'group',color:'#1565c0',members:[],links:[]};
  const war={room_id:'war',name:'War room',description:'Targets and call-outs',visibility:'faction',icon:'assault',color:'#b22222',members:[],links:[]};
  const admin={leaders:[1],rooms:[general,war]};
  window.client={model:{rooms:[general,war],status:'ready',userId:1,factionId:10,leader:true,personal:{used:0,limit:1,rooms:[]}},room(id){if(!states.has(id))states.set(id,{unread:2,access:{read:true,speak:true,moderate:true},messages:new Map([[id+'-1',{message_id:id+'-1',seq:1,revision:1,user_id:2,display_name:'Redline',origin_faction_id:10,created_at:Date.now()-60000,content:{type:'text',text:'We can lend you four hitters from 20:00 TCT'}}],[id+'-2',{message_id:id+'-2',seq:2,revision:1,user_id:1,display_name:'Considious',origin_faction_id:10,created_at:Date.now(),content:{type:'text',text:'Keep this room for coordination'}}]]),pending:new Map(),status:'connected',presence:[]});return states.get(id);},setActive(){},setViewedRoom(){},setBackground(){},dispose(){},subscribe(fn){callbacks.add(fn);return()=>callbacks.delete(fn);},async refresh(){for(const f of callbacks)f({type:'list'});},async connect(){},command(){},send(id,content){calls.push({send:id,content});},members:async()=>({members:[{user_id:1,user_name:'Considious',position:'Leader'},{user_id:2,user_name:'Redline',position:'Officer'}]}),async api(path,input){calls.push({path,input});if(path==='/api/personal-rooms'){if(input.action==='create'){const room={room_id:'personal',owner_id:1,personal:true,visibility:'selected',members:[],...input};this.model.personal={used:1,limit:1,rooms:[room]};this.model.rooms.push(room);}return {};}if(path==='/api/admin'){if(input?.action==='room.update'){Object.assign(admin.rooms.find(r=>r.room_id===input.room_id),input);return {room_id:input.room_id};}return admin;}}};
  window.emit=()=>{for(const f of callbacks)f({type:'list'});};
  window.ui=SLINK_FACTION_NODE_UI.mount({client,preferences:{get:async()=>settings,patch:async change=>Object.assign(settings,change)},activity:{eligible:()=>true,subscribe:()=>()=>{}},view:{get:async()=>null,save:async()=>{}}});
 });
 await page.locator('#slink-faction-node-button').click();
 assert.equal(await page.getByRole('tab',{name:'Your rooms',exact:true}).isVisible(),true);
 await page.getByRole('searchbox',{name:'Search your rooms'}).fill('no results');await page.getByText('No matching rooms.').waitFor();await page.getByRole('searchbox',{name:'Search your rooms'}).fill('');
 if(width>700){await page.getByRole('button',{name:'Alliance HQ, 2 unread',exact:true}).click();await page.getByRole('button',{name:'War room, 2 unread',exact:true}).click();
 const hub=await page.getByRole('searchbox',{name:'Search your rooms'}).boundingBox();for(const composer of await page.locator('[data-draft]:visible').all())assert((await composer.boundingBox()).x<hub.x);
 const war=page.locator('[data-slink-faction-node]').filter({has:page.locator('[data-window-title]',{hasText:'War room'})});
 assert.equal(await war.locator('.tr-panel').evaluate(el=>getComputedStyle(el).getPropertyValue('--tr-room').trim()),'#b22222');
 assert.equal(await war.locator('[data-header-icon] svg').count(),1);
 await war.getByRole('textbox',{name:'Room message'}).fill('Hello');await war.getByRole('textbox',{name:'Room message'}).press('Enter');assert.equal(await page.evaluate(()=>calls.some(c=>c.send==='war'&&c.content.text==='Hello')),true);
 await page.screenshot({path:output+platform+'-chat.png'});
 await war.getByRole('button',{name:'Minimize faction rooms',exact:true}).click();await page.locator('[data-room-pin="war"]').click();await war.getByRole('button',{name:'Close room',exact:true}).click();assert.equal(await page.locator('[data-room-pin="war"]').count(),0);
 }
 await page.getByRole('button',{name:'Create New Chat Room',exact:true}).click();
 await page.getByRole('textbox',{name:'Room name',exact:true}).fill('My crew');
 await page.locator('[data-personal-form] .tr_iconButton___URo_b').click();await page.getByPlaceholder('Search icons').fill('halloween');await page.getByRole('button',{name:'Use halloween_pumpkin icon'}).click();
 await page.getByTitle('#6a1b9a',{exact:true}).click();await page.getByRole('button',{name:'Create personal room',exact:true}).click();
 await page.waitForFunction(()=>client.model.personal.used===1);assert.equal(await page.evaluate(()=>calls.find(c=>c.input?.action==='create').input.icon),'halloween_pumpkin');assert.equal(await page.evaluate(()=>calls.find(c=>c.input?.action==='create').input.color),'#6a1b9a');
 await page.getByRole('tab',{name:'Rooms settings',exact:true}).click();await page.getByRole('checkbox',{name:'Notification sounds',exact:true}).uncheck();assert.equal(await page.evaluate(()=>settings.soundEnabled),false);
 await page.getByRole('tab',{name:'Your rooms',exact:true}).click();await page.screenshot({path:output+platform+'-hub.png'});
 // The same native room editor is used by dashboard management, not a tiny chat clone.
 await page.evaluate(async()=>{ui.dispose();window.manager=SLINK_FACTION_NODE_UI.mountAdmin({container:document.getElementById('manager'),client});await manager.open();});
 const form=page.locator('[data-metadata-form]');await form.getByRole('textbox',{name:'Room name',exact:true}).fill('Alliance renamed');await form.locator('.tr_iconButton___URo_b').click();await form.getByPlaceholder('Search icons').fill('assault');await form.getByRole('button',{name:'Use assault icon',exact:true}).click();await form.getByTitle('#b22222',{exact:true}).click();
 await page.evaluate(()=>window.dispatchEvent(new Event('blur')));assert.equal(await form.getByRole('textbox',{name:'Room name',exact:true}).inputValue(),'Alliance renamed');
 await form.getByRole('button',{name:'Save room',exact:true}).click();await page.getByText('Room saved.',{exact:true}).waitFor();
 assert.equal(await form.getByRole('textbox',{name:'Room name',exact:true}).isVisible(),true);assert.equal(await page.locator('[data-member]').isVisible(),true);
 const update=await page.evaluate(()=>calls.find(c=>c.input?.action==='room.update').input);assert.equal(update.icon,'assault');assert.equal(update.color,'#b22222');assert.equal(update.name,'Alliance renamed');
 await page.locator('[data-member]').fill('Officer');assert.equal(await page.locator('[data-member-access]').count(),1);await page.screenshot({path:output+platform+'-management.png'});
 assert.deepEqual(errors,[]);await page.close();console.log(platform+' native Torn Rooms UI: selector, icons, create/edit, colors, sounds, message send, docking, minimize/close and management passed.');
 }}finally{await browser.close();}
