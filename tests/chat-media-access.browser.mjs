import assert from 'node:assert/strict';
import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),{chromium}=require(process.env.SLINK_PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({headless:true,executablePath:process.env.SLINK_BROWSER_EXECUTABLE||'C:/Program Files/Google/Chrome/Application/chrome.exe'});
const read=path=>fs.readFileSync(new URL('../'+path,import.meta.url),'utf8');
try{
 const page=await browser.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.setContent('<main></main>');
 for(const path of ['src/core/chat-giphy.js','src/core/chat-giphy-ui.js'])await page.addScriptTag({path:fileURLToPath(new URL('../'+path,import.meta.url))});
 for(const scenario of ['fresh','disabled','read-failure']){
  await page.evaluate(async scenario=>{
   window.stored=scenario==='disabled'?{enabled:false}:{};window.failRead=scenario==='read-failure';window.requests=[];window.requestPaths=[];window.writes=0;
   const client=SLINK_GIPHY.createClient({read:async()=>{if(failRead)throw Error('Synthetic settings read failure');return stored;},write:async value=>{writes++;stored=value;},authorize:async()=>{},request:async url=>{requests.push(new URL(url).searchParams.get('q')||'');requestPaths.push(new URL(url).pathname);return {status:200,body:{data:[],pagination:{total_count:0}}};}});
   window.picker=SLINK_GIPHY_PANEL(client,{chatWindow:true,isActive:()=>true});document.querySelector('main').replaceChildren(picker.host);await picker.ready;
  },scenario);
  const query=page.locator('[data-query]');
  if(scenario==='read-failure'){
   assert.equal(await query.isEnabled(),false);
   assert.match(await page.locator('[data-status]').textContent(),/Synthetic settings read failure/);
   await page.evaluate(()=>{failRead=false;});await page.locator('[data-load-retry]').click();
  }
  if(scenario==='disabled'){
   assert.equal(await query.isEnabled(),true,'Explicitly disabled feature must not present an unexplained inert text box');
   assert.equal(await page.evaluate(()=>stored.enabled),false,'Do not silently override a saved opt-out');
   await page.locator('[data-enable-picker]').click();await page.waitForFunction(()=>stored.enabled===true);
   assert.equal(await page.evaluate(()=>writes),1);
  }
  assert.equal(await query.isEnabled(),true);await query.fill('working search');await query.press('Enter');await page.waitForFunction(()=>requests.includes('working search'));
  await page.waitForFunction(()=>!document.querySelector('[data-slink-giphy]').shadowRoot.querySelector('[data-search]').disabled);
  assert.equal(await page.locator('[data-search]').isEnabled(),true);
  await page.evaluate(()=>picker.open('sticker'));await page.waitForFunction(()=>requestPaths.includes('/v1/stickers/search'));
  await page.evaluate(()=>picker.stop());
 }
 assert.deepEqual(errors,[]);
 console.log('Extension shared media picker: fresh defaults, preserved opt-out, visible settings read retry, GIF and sticker search dispatch passed.');
}finally{await browser.close();}
