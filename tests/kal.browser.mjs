import {createRequire} from 'node:module';
import {createServer} from 'node:http';
import {readFile,mkdir} from 'node:fs/promises';
import {dirname,resolve} from 'node:path';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url);let chromium;
try{({chromium}=require('playwright'));}catch{({chromium}=require(resolve(dirname(process.execPath),'../node_modules/playwright')));}
const attack={DB:{defenderUser:{userID:42},attackerUser:{userID:77},fightID:123,attackStatus:'started',showEnemyItems:true,defenderItems:{'398':{item:[{ID:398,equipSlot:1,armouryID:456,bonuses:[{name:'Warlord',value:24}]}]}},currentClips:[]}};
const server=createServer((request,response)=>{if(request.url.includes('sid=attackData')){response.writeHead(200,{'Content-Type':'application/json'});response.end(JSON.stringify(attack));return;}response.writeHead(200,{'Content-Type':'text/html'});response.end('<!doctype html><html><body><div id="official-kal">Official KAL remains active</div><section id="settings"></section></body></html>');});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
let browser;
try{
  browser=await chromium.launch({headless:true,channel:'chrome'});
  const page=await browser.newPage({viewport:{width:390,height:844}});
  await page.goto('http://127.0.0.1:'+server.address().port+'/profiles.php?XID=42');
  await page.addScriptTag({content:await readFile(new URL('../src/core/kal.js',import.meta.url),'utf8')});
  await page.addScriptTag({content:await readFile(new URL('../src/core/kal-ui.js',import.meta.url),'utf8')});
  await page.evaluate(()=>{
    window.copied=null;window.requests=[];window.state={connected:true,enabled:true,display:'manual',collectorReason:'Collector disabled pending permission.'};
    const loadout=(older=false)=>({user_id:42,name:'Example',observed_at:older?1786331600:1786331700,equipment:[{id:398,name:older?'Older weapon':'SIG 552',slot_name:'primary',item_ref:'kAbCdEfGhIjK',stats:{damage:77.19,quality:41.72},bonuses:[{title:'Warlord',description:'24% respect'}],mods:[{name:'Laser',description:'+2% critical hit rate'}],ammo:{id:5,type:'Tracer'}}],pagination:{next_cursor:older?null:'opaque+/='}});
    window.client={status:async()=>state,connect:async(_key,consent)=>{if(!consent)throw Error('Consent required');return state;},configure:async value=>Object.assign(state,value),disconnect:async()=>Object.assign(state,{connected:false,enabled:false}),load:async(id,cursor)=>{requests.push({id,cursor});return loadout(!!cursor);}};
    SLINK_KAL_UI.mountSettings(document.querySelector('#settings'),client);
    window.panel=SLINK_KAL_UI.mountPage({client,clipboard:async text=>{copied=text;}});
  });
  assert.equal(await page.evaluate(()=>requests.length),0,'manual view must not request equipment');
  await page.locator('#slink-kal-panel summary').click();
  await page.getByText('SIG 552',{exact:false}).waitFor();
  assert.equal(await page.locator('#slink-kal-panel').evaluate(node=>node.getBoundingClientRect().right<=innerWidth),true,'mobile overflow');
  await page.getByRole('button',{name:'Copy selected',exact:true}).click();assert.ok((await page.evaluate(()=>copied)).includes('SIG 552'));
  await page.getByRole('button',{name:'Older',exact:true}).click();await page.getByText('Older weapon',{exact:false}).waitFor();
  await page.getByRole('button',{name:'Copy selected',exact:true}).click();assert.ok((await page.evaluate(()=>copied)).includes('Older weapon'));
  assert.equal((await page.evaluate(()=>requests.at(-1))).cursor,'opaque+/=');
  await page.getByRole('button',{name:'Latest',exact:true}).click();await page.getByText('SIG 552',{exact:false}).waitFor();
  for(const [theme,bg,fg]of [['dark','#18202a','#eeeeee'],['light','#ffffff','#222222']]){
    await page.evaluate(({bg,fg})=>{document.documentElement.style.setProperty('--s-panel',bg);document.documentElement.style.setProperty('--s-text',fg);},{bg,fg});
    const colors=await page.locator('#slink-kal-panel').evaluate(node=>({bg:getComputedStyle(node).backgroundColor,fg:getComputedStyle(node).color}));assert.notEqual(colors.bg,colors.fg);
    await mkdir('.qa',{recursive:true});await page.screenshot({path:'.qa/kal-'+theme+'.png'});
  }
  await page.locator('#settings select').selectOption('official');await page.waitForFunction(()=>document.querySelector('#slink-kal-panel').hidden);
  assert.equal(await page.locator('#official-kal').textContent(),'Official KAL remains active');
  await page.locator('#settings select').selectOption('manual');await page.waitForFunction(()=>!document.querySelector('#slink-kal-panel').hidden);
  await page.getByRole('button',{name:'Disconnect / Clear key',exact:true}).click();await page.waitForFunction(()=>document.querySelector('#slink-kal-panel').hidden);
  assert.equal(await page.evaluate(()=>SLINK_KAL_UI.pagePlayer({href:'https://www.torn.com/page.php?sid=attack&user2ID=123'})),123);
  // Real IndexedDB transactions, corruption recovery, bounded cache and close/reopen.
  const result=await page.evaluate(async()=>{const store=SLINK_KAL.openCache(indexedDB,'test-kal-cache');await store.clear();await Promise.all(Array.from({length:180},(_,n)=>store.put({id:String(n),at:n,schema:1,value:n})));const retained=await Promise.all(['0','30','179'].map(id=>store.get(id)));await store.clear();return{retained,empty:await store.get('179')};});
  assert.equal(result.retained[0],undefined);assert.equal(result.retained[1].value,30);assert.equal(result.retained[2].value,179);assert.equal(result.empty,undefined);
  await page.goto('http://127.0.0.1:'+server.address().port+'/page.php?sid=attack&user2ID=42');
  await page.addScriptTag({content:await readFile(new URL('../vendor/kal/capture.js',import.meta.url),'utf8')});
  await page.addScriptTag({content:await readFile(new URL('../src/core/kal-contributions.js',import.meta.url),'utf8')});
  await page.evaluate(()=>{window.officialCalls=0;const original=fetch;window.fetch=function(...args){officialCalls++;return original.apply(this,args);};window.uploads=[];window.queueState=null;window.collector=SLINK_KAL_CONTRIBUTIONS.create({store:{get:async()=>queueState,set:async value=>{queueState=structuredClone(value);}},auth:async()=>({enabled:true,scope:'mock-account',key:'abcdefghijklmnop'}),request:async(url,options)=>{uploads.push({url,body:JSON.parse(options.body)});return{status:200,text:'{}'};}});document.addEventListener('slink:kal:observation',event=>void collector.enqueue(JSON.parse(event.detail)));});
  await page.addScriptTag({content:await readFile(new URL('../src/content/kal-observer.js',import.meta.url),'utf8')});
  await page.evaluate(async()=>{await fetch('/page.php?sid=attackData');});
  assert.equal(await page.evaluate(()=>uploads.length),0,'official collector mode must not upload through SLINK');
  await page.evaluate(()=>document.dispatchEvent(new CustomEvent('slink:kal:collector-state',{detail:'{"enabled":true}'})));
  await page.evaluate(async()=>{await Promise.all([fetch('/page.php?sid=attackData'),fetch('/page.php?sid=attackData')]);});
  await page.waitForFunction(()=>uploads.length===1);
  const observed=await page.evaluate(async()=>{await collector.drain();return{upload:uploads[0],status:await collector.status(),calls:officialCalls};});
  assert.equal(observed.upload.url,'https://kalends.dev/api/script/upload-loadout');assert.equal(observed.upload.body.target_id,42);assert.equal(observed.upload.body.defender_items['398'].item[0].bonuses[0].value,24);assert.equal(observed.status.pendingCount,0);assert.ok(observed.status.lastSuccess);assert.equal(observed.calls,3,'existing fetch wrapper remains operational');
  await page.evaluate(async()=>{document.body.append(document.createElement('div'));await fetch('/page.php?sid=attackData');});assert.equal(await page.evaluate(()=>uploads.length),1,'page rerender must not duplicate a contribution');
  console.log('KAL browser checks passed: manual fetch, latest/history/copy, mobile layout, themes, explicit coexistence display, disconnect, IndexedDB concurrency/eviction.');
  console.log('KAL mock capture-to-submission passed: original fetch wrapper preserved, opted-out observer silent, simultaneous native responses and rerender produce one acknowledged contribution.');
}finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
