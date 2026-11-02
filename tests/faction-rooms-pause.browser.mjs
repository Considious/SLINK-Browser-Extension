import assert from 'node:assert/strict';
import {fileURLToPath,pathToFileURL} from 'node:url';
const {chromium}=await import(pathToFileURL(process.env.SLINK_BROWSER_PACKAGE).href);
const browser=await chromium.launch({headless:true,executablePath:process.env.SLINK_BROWSER_EXECUTABLE});
try{
 const page=await browser.newPage();await page.route('https://fixture.example.test/**',route=>route.fulfill({contentType:'text/html',body:'<main id="manager"></main><p id="status"></p>'}));await page.goto('https://fixture.example.test/');
 await page.evaluate(()=>{window.allowed=true;window.active=true;window.refreshes=0;window.statusWrites=[];window.settings={noticeAccepted:'third-party-rooms-v1'};window.SLINK_EXTENSION={modules:{},core:{permissions:{hasAllScopes:()=>allowed},format:{errorMessage:String},messaging:{send:async(type,input)=>{if(type.endsWith('settings.get'))return settings;if(type.endsWith('settings.patch'))return Object.assign(settings,input);throw Error('Unexpected route '+type);}}},define(group,name,value){this[group][name]=value;}};});
 for(const file of ['src/core/modules.js','src/core/faction-node-client.js','src/core/faction-node-ui.js','src/core/faction-node-settings.js'])await page.addScriptTag({path:fileURLToPath(new URL('../'+file,import.meta.url))});
 await page.evaluate(()=>{const room={room_id:'general',name:'General',visibility:'selected',members:[],links:[]};window.SLINK_FACTION_NODE={...SLINK_FACTION_NODE,create:()=>({model:{leader:true},setActive(){},dispose(){},refresh:async()=>{refreshes++;},members:async()=>({members:[{user_id:2,user_name:'Member',position:'Officer'}]}),api:async()=>({rooms:[room],leaders:[1]})})};window.context={url:new URL('https://www.torn.com/'),permissions:{},isActive:()=>active,ui:{createModuleView:async()=>({getContentElement:()=>document.getElementById('manager'),setStatus:text=>{statusWrites.push(text);document.getElementById('status').textContent=text;},remove:()=>document.getElementById('manager').replaceChildren()})}};});
 await page.addScriptTag({path:fileURLToPath(new URL('../src/modules/faction-rooms.js',import.meta.url))});
 await page.evaluate(()=>SLINK_EXTENSION.modules.startAll(context));await page.locator('[data-name]').fill('Keep my unfinished room');
 await page.evaluate(()=>{window.original=document.querySelector('[data-slink-room-management]');window.requestsBefore=refreshes;active=false;SLINK_EXTENSION.modules.invalidate({pause:true});});await page.evaluate(()=>SLINK_EXTENSION.modules.stopAll({preserveUi:true,pause:true}));
 assert.equal(await page.locator('[data-name]').inputValue(),'Keep my unfinished room');assert.equal(await page.locator('[data-admin-form]').isVisible(),true);
 await page.evaluate(async()=>{active=true;await SLINK_EXTENSION.modules.startAll(context);});
 assert.equal(await page.evaluate(()=>document.querySelector('[data-slink-room-management]')===original),true);assert.equal(await page.evaluate(()=>refreshes===requestsBefore),true);assert.equal(await page.locator('[data-name]').inputValue(),'Keep my unfinished room');assert.equal(await page.locator('#status').textContent(),'');
 await page.evaluate(()=>SLINK_EXTENSION.modules.stopAll());assert.equal(await page.locator('[data-slink-room-management]').count(),0);
 console.log('Actual module lifecycle + settings/manager browser: blur/resume preserves form, draft and node, without reload; full cleanup disposes.');
}finally{await browser.close();}
