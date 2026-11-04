import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.SLINK_PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({headless:true,executablePath:process.env.SLINK_BROWSER_EXECUTABLE||'C:/Program Files/Google/Chrome/Application/chrome.exe'});
try{
 for(const path of ['../src/core/chat-ff.js',...process.argv.slice(2)]){
  const page=await browser.newPage();
  await page.setContent('<div id="chatRoot"><span class="senderContainer___a"><a class="sender___a" href="/profiles.php?XID=2272745">Name</a></span><span id="mixed" class="body___a message___a"><span>Check [2272745] before <a href="/page.php?sid=attack&amp;user2ID=2272745">Attack</a> and <a href="/profiles.php?XID=2272745">Profile</a> now</span></span><p id="bare" class="body___a message___a">2272745</p><p id="price" class="body___a message___a">Price: 2272745</p></div>');
  await page.addScriptTag({content:readFileSync(new URL(path,import.meta.url),'utf8')});
  await page.evaluate(()=>{
   window.live=true;window.mentions=true;window.senders=true;window.batches=[];
   window.controller=SLINK_CHAT_FF.mount({activity:{eligible:()=>live,subscribe:()=>{}},enabled:()=>senders,mentions:()=>mentions,lookup:async ids=>{batches.push(ids);return ids.map(id=>({id,ff:2.25,source:'FFScouter'}));}});
  });
  await page.waitForFunction(()=>document.querySelectorAll('[data-slink-chat-ff]:not([hidden])').length===5);
  assert.deepEqual(await page.evaluate(()=>batches),[[2272745]]);
  assert.equal(await page.locator('#mixed').textContent(),'Check [2272745]2.25 before Attack2.25 and Profile2.25 now');
  assert.equal(await page.locator('#bare a').getAttribute('href'),'https://www.torn.com/profiles.php?XID=2272745');
  assert.equal(await page.locator('#price [data-slink-chat-ff]').count(),0);
  await page.evaluate(()=>{live=false;controller.sync();});
  assert.equal(await page.locator('#mixed [data-slink-chat-ff]:not([hidden])').count(),3);
  await page.evaluate(()=>{live=true;controller.sync();document.querySelector('#bare').firstChild.data='Not a mention';});
  await page.waitForFunction(()=>!document.querySelector('#bare [data-slink-chat-ff]'));
  await page.evaluate(()=>{mentions=false;controller.sync();});
  assert.equal(await page.locator('#mixed').textContent(),'Check [2272745] before Attack and Profile now');
  assert.equal(await page.locator('.senderContainer___a [data-slink-chat-ff]').count(),1);
  await page.close();
 }
 console.log('Inline Fair Fight placement, shared batching, blur, recycled text and independent toggle passed on both clients.');
}finally{await browser.close();}
