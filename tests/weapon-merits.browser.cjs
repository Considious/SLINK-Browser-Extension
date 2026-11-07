const assert=require('node:assert/strict'),path=require('node:path');
const {chromium}=require(process.env.SLINK_PLAYWRIGHT_MODULE||'playwright');
const modelPath='../src/core/weapon-merits.js';
require(modelPath);
const model=globalThis.SLINK_WEAPON_MERITS;
assert.deepEqual(model.perks({perks:{merit:['+ Rifle 5% damage / 1.0 accuracy','Merit: + Club 2% damage / 0.4 accuracy','+ Pistol 4% damage / 0.1 accuracy','+ Shotgun 0% damage / 0 accuracy']}}),{rifle:5,club:2});
assert.deepEqual(model.catalogue({items:[{id:1,type:'Weapon',sub_type:'Rifle'},{id:2,type:'Weapon',sub_type:'Temporary',details:{base_stats:{damage:0}}}]}),{1:'rifle'});
assert.equal(model.suffix(0,'damage'),'');
const row=(id,base='70.96')=>'<li data-item="'+id+'"><div class="box"><i class="bonus-attachment-item-damage-bonus"></i><span>'+base+'</span></div><div class="box"><i class="bonus-attachment-item-accuracy-bonus"></i><span>60.20</span></div></li>';
(async()=>{
 const browser=await chromium.launch({channel:'msedge'});
 try{for(const pda of [false,true]){
   const page=await browser.newPage({viewport:{width:pda?360:1100,height:800}});
   await page.route('https://www.torn.com/**',r=>r.fulfill({contentType:'text/html',body:'<style>.box{width:75px;overflow:hidden;display:inline-block;font:14px Arial;white-space:nowrap}</style><main id="mainContainer"><ul>'+row(1)+row(2)+row(3,'90.00<span> native bonus</span>')+'</ul></main>'}));
   await page.addInitScript(pda=>{
     window.tier=5;window.owner='12';window.requests=0;
     const cache={};
     if(pda)window.SLINK_PDA_PLUGIN_API={accountId:()=>window.owner,cache:()=>cache,tornJson:async url=>{
       window.requests++;return url.includes('perks')?{perks:{merit:window.tier?['+ Rifle '+window.tier+'% damage / '+window.tier/5+' accuracy']:[]}}:
         {items:[{id:1,type:'Weapon',sub_type:'Rifle'},{id:2,type:'Weapon',sub_type:'Shotgun'},{id:3,type:'Weapon',sub_type:'Rifle'}]};
     }};
     else window.SLINK_EXTENSION={core:{storage:{get:async()=>({token:'x',userId:window.owner,expiresAt:Date.now()+60000})},messaging:{send:async()=>{
       window.requests++;return {levels:window.tier?{rifle:window.tier}:{},classes:{1:'rifle',2:'shotgun',3:'rifle'}};
     }}}};
   },pda);
   await page.goto('https://www.torn.com/item.php');
   await page.addScriptTag({path:path.join(__dirname,modelPath)});
   await page.addScriptTag({path:path.join(__dirname,'../src/content/weapon-merits.js')});
   const labels=page.locator('[data-slink-weapon-merit]');
   assert.equal(await page.evaluate(()=>window.requests),0);
   await page.getByRole('button',{name:'Show weapon merits'}).click();
   await page.getByText('(+5%)',{exact:true}).waitFor();
   assert.equal(await page.locator('li[data-item="1"] .box').first().innerText(),'70.96 (+5%)');
   assert.equal(await page.locator('li[data-item="2"] [data-slink-weapon-merit],li[data-item="3"] .box:first-child [data-slink-weapon-merit]').count(),0);
   assert.equal(await labels.evaluateAll(nodes=>nodes.every(n=>n.getBoundingClientRect().right<=n.closest('.box').getBoundingClientRect().right)),true);
   await page.evaluate(()=>{document.body.classList.add('dark-mode');window.tier=0;});
   await page.getByRole('button',{name:'Refresh weapon merits'}).click();
   await page.getByText('No weapon mastery bonuses found.').waitFor();
   await page.waitForFunction(()=>!document.querySelector('[data-slink-weapon-merit]'));
   await page.close();
 }}finally{await browser.close();}
 console.log('Weapon merits: verified units, zero/unknown omitted, native bonus preserved, and narrow inline layout passed');
})().catch(e=>{console.error(e);process.exitCode=1;});
