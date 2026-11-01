import assert from 'node:assert/strict';
import {pathToFileURL,fileURLToPath} from 'node:url';
const {chromium}=await import(process.env.SLINK_BROWSER_PACKAGE?pathToFileURL(process.env.SLINK_BROWSER_PACKAGE).href:'playwright');
const browser=await chromium.launch({headless:true,executablePath:process.env.SLINK_BROWSER_EXECUTABLE||'C:/Program Files/Google/Chrome/Application/chrome.exe'});
try{
 const context=await browser.newContext();await context.route('https://fixture.test/**',r=>r.fulfill({contentType:'text/html',body:'<!doctype html><title>Room lifecycle fixture</title>'}));
 // Headless Chrome does not reliably reflect operating-system window focus.
 // Supply explicit focus signals, but use actual independent pages and the
 // real browser BroadcastChannel implementation for ownership propagation.
 const pages=[];for(const id of [1,2]){const page=await context.newPage();await page.goto('https://fixture.test/torn-'+id);await page.addScriptTag({path:fileURLToPath(new URL('../src/core/faction-node-client.js',import.meta.url))});await page.evaluate(()=>{window.fixtureFocused=false;Object.defineProperty(document,'hasFocus',{value:()=>fixtureFocused});const subscribers=new Set();window.tornGate={eligible:()=>document.visibilityState==='visible'&&document.hasFocus(),subscribe:fn=>{subscribers.add(fn);return()=>subscribers.delete(fn);}};for(const event of ['focus','blur'])window.addEventListener(event,()=>{for(const fn of subscribers)fn(tornGate.eligible());});window.roomGate=SLINK_FACTION_NODE.createRoomActivity({activity:tornGate});});pages.push(page);}
 const activate=async index=>{for(const page of pages)await page.evaluate(()=>{fixtureFocused=false;window.dispatchEvent(new Event('blur'));});if(index>=0)await pages[index].evaluate(()=>{fixtureFocused=true;window.dispatchEvent(new Event('focus'));});};
 await activate(0);await pages[0].waitForFunction(()=>roomGate.eligible());
 await activate(-1);assert.equal(await pages[0].evaluate(()=>tornGate.eligible()),false);assert.equal(await pages[0].evaluate(()=>roomGate.eligible()),true,'Blur must preserve third-party Rooms while the Torn gate is off');
 await activate(1);await pages[1].waitForFunction(()=>roomGate.eligible());await pages[0].waitForFunction(()=>!roomGate.eligible());
 await activate(0);await pages[0].waitForFunction(()=>roomGate.eligible());await pages[1].waitForFunction(()=>!roomGate.eligible());
 for(const page of pages)await page.evaluate(()=>roomGate.dispose());console.log('Chromium cross-page BroadcastChannel ownership and separate Torn/Rooms gates passed with explicit focus signals.');
}finally{await browser.close();}
