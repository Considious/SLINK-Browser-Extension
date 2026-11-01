import assert from 'node:assert/strict';
import {pathToFileURL,fileURLToPath} from 'node:url';
const {chromium}=await import(process.env.SLINK_BROWSER_PACKAGE?pathToFileURL(process.env.SLINK_BROWSER_PACKAGE).href:'playwright');
const browser=await chromium.launch({headless:true,executablePath:process.env.SLINK_BROWSER_EXECUTABLE||'C:/Program Files/Google/Chrome/Application/chrome.exe'});
try{
 const page=await browser.newPage({viewport:{width:1600,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.setContent(`<style>body{margin:0}section{margin:7px;position:absolute;left:0;top:0}.rail{position:fixed;right:20px;bottom:40px;width:0;height:0}.item___fixture{position:absolute;right:0;bottom:0;width:308px;height:400px}.root___tV4zg{width:max-content;padding-right:8px;background:#444}.root___Ex8tg{width:300px;height:400px;box-sizing:border-box;border:1px solid white;background:#333}.bar{position:fixed;bottom:0;right:0;height:34px;display:flex}</style><main><div id="chatRoot"><div class="rail root___PF7AM">${[0,1,2].map(i=>`<div class="item___fixture" style="transform:translateX(-${i*313}px);transition-duration:150ms"><div class="root___tV4zg"><div class="root___Ex8tg" id="native-${i}"></div></div></div>`).join('')}</div><div class="bar root___Ef1Ql"></div></div></main>`);
 await page.addScriptTag({path:process.env.SLINK_ROOM_UI_FILE||fileURLToPath(new URL('../src/core/faction-node-ui.js',import.meta.url))});
 await page.evaluate(()=>{
  window.active=true;window.callbacks=new Set();window.refreshes=0;
  window.client={model:{status:'ready',userId:1,factionId:10,leader:false,rooms:[]},setActive(){},dispose(){},subscribe:()=>()=>{},async refresh(){refreshes++;},room:()=>({unread:0})};
  window.ui=SLINK_FACTION_NODE_UI.mount({client,activity:{eligible:()=>true,subscribe:()=>()=>{}},domActivity:{eligible:()=>active,subscribe:f=>{callbacks.add(f);return()=>callbacks.delete(f);}},view:{get:async()=>({visible:true,view:'home',userId:1,factionId:10,roomId:null}),save:async()=>{}}});
 });
 await page.waitForTimeout(50);
 assert.equal(await page.locator('[data-slink-faction-node]').evaluateAll(nodes=>nodes.some(el=>!el.hidden&&getComputedStyle(el).visibility!=='hidden')),false,'Saved Rooms must not become visible at (0,0) before the chat bar is ready');
 await page.evaluate(()=>{document.querySelector('.bar').innerHTML='<button id="people_panel_button">People</button><button id="notes_settings_button">Settings</button>';});
 await page.waitForFunction(()=>{const el=document.querySelector('[data-slink-faction-node]');return el&&!el.hidden&&getComputedStyle(el).visibility==='visible';});
 async function geometry(){return page.evaluate(()=>{const room=document.querySelector('[data-slink-faction-node]').getBoundingClientRect(),native=[...document.querySelectorAll('.root___tV4zg')].map(el=>el.getBoundingClientRect()).sort((a,b)=>a.left-b.left);return {gap:room.left-native.at(-1).right,nativeGap:native[1].left-native[0].right,left:room.left,top:room.top,height:room.height};});}
 for(const zoom of [1,.9,1.25,1,.9,1.25]){
  await page.evaluate(zoom=>{document.querySelector('.rail').style.zoom=zoom;window.dispatchEvent(new Event('resize'));},zoom);
  await page.waitForFunction(()=>Math.abs(document.querySelector('[data-slink-faction-node]').getBoundingClientRect().width-document.querySelector('.root___Ex8tg').getBoundingClientRect().width)<.6,{},{timeout:3000});
  const g=await geometry();assert(Math.abs(g.gap-g.nativeGap)<.6,`Rooms gap ${g.gap} must match Torn gap ${g.nativeGap}, including outer wrappers and zoom ${zoom}`);assert(g.gap>0);assert(g.top>0);
 }
 await page.evaluate(()=>{document.querySelector('.item___fixture').remove();document.querySelectorAll('.item___fixture').forEach((el,i)=>{el.style.transform='translateX(-'+i*313+'px)';});});await page.waitForTimeout(300);
 const closedNative=await geometry();assert(Math.abs(closedNative.gap-closedNative.nativeGap)<.6,'Closing a native chat must keep the gap after Torn finishes sliding the remaining chats');
 // Native badges extend above the bar into the Rooms rectangle. Hit-testing
 // verifies they are visible AND clickable, not just numerically higher z-index.
 await page.evaluate(()=>{window.alertClicks=0;const badge=document.createElement('button');badge.dataset.nativeAlert='';badge.textContent='1';badge.style.cssText='position:absolute;right:30px;top:-18px;width:24px;height:24px;border-radius:50%;background:lime';badge.onclick=()=>alertClicks++;document.querySelector('.bar').append(badge);});
 for(const layer of ['auto','1','900']){await page.evaluate(value=>{document.querySelector('.bar').style.zIndex=value;window.dispatchEvent(new Event('resize'));},layer);await page.waitForTimeout(80);const badge=await page.locator('[data-native-alert]').boundingBox(),x=badge.x+10,y=badge.y+4;
  assert.equal(await page.evaluate(({x,y})=>!!document.elementFromPoint(x,y)?.closest('[data-native-alert]'),{x,y}),true,'Native unread badges must be above Rooms, including their protruding portion');await page.mouse.click(x,y);
 }
 assert.equal(await page.evaluate(()=>alertClicks),3);await page.locator('[data-native-alert]').evaluate(el=>el.remove());
 const before=await geometry();
 await page.evaluate(()=>{active=false;for(const f of callbacks)f();});await page.waitForTimeout(50);assert.deepEqual(await geometry(),before,'Blur must not release or reposition the reserved slot');
 await page.evaluate(()=>{active=true;for(const f of callbacks)f();});await page.locator('[data-close]').click();assert.equal(await page.locator('[data-slink-room-reserve]').count(),0);
 await page.locator('#slink-faction-node-button').click();const reopened=await geometry();assert(Math.abs(reopened.gap-reopened.nativeGap)<.6);
 assert.equal(await page.locator('.item___fixture').first().evaluate(el=>el.style.transform),'translateX(0px)','Torn native transforms must be untouched');
 await page.evaluate(()=>ui.dispose());
 const chatMarkup=await page.locator('#chatRoot').evaluate(el=>el.outerHTML);
 await page.evaluate(()=>{document.getElementById('chatRoot').remove();active=false;ui=SLINK_FACTION_NODE_UI.mount({client,activity:{eligible:()=>true,subscribe:()=>()=>{}},domActivity:{eligible:()=>active,subscribe:f=>{callbacks.add(f);return()=>callbacks.delete(f);}},view:{get:async()=>({visible:true,view:'home',userId:1,factionId:10}),save:async()=>{}}});});
 assert.equal(await page.locator('[data-slink-faction-node]').count(),0,'Unfocused restore cannot create an undocked window');
 await page.evaluate(()=>{active=true;for(const f of callbacks)f();});
 await page.evaluate(html=>{document.querySelector('main').innerHTML=html;},chatMarkup);
 await page.waitForFunction(()=>{const el=document.querySelector('[data-slink-faction-node]');return el&&!el.hidden&&getComputedStyle(el).visibility==='visible';});
 const late=await geometry();assert(Math.abs(late.gap-late.nativeGap)<.6,'Nested late chat-root insertion must restore without a user click');
 await page.evaluate(()=>ui.dispose());assert.deepEqual(errors,[]);
 console.log('Delayed chat-bar restoration stays hidden until docked; outer-frame gaps match native chats at 90%, 100% and 125% zoom; blur and reopening retain spacing.');
}finally{await browser.close();}
