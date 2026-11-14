const assert = require('node:assert/strict');
const {chromium} = require(process.env.SLINK_PLAYWRIGHT_MODULE || 'playwright');
const path = require('node:path');
const files={'followup-filter':'content/native-list-filter','followup-components':'core/torn-components','followup-mastery':'content/weapon-merits','followup-details':'content/weapon-details','followup-extension-ui':'core/qol-ui','weapon-merits':'core/weapon-merits','qol':'core/qol'};
const source = f => path.join(__dirname,'../src',files[f]+'.js');
(async()=>{
 const browser=await chromium.launch({channel:'chrome'});
 try{
  const page=await browser.newPage({viewport:{width:400,height:750}});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  const item='<img src="/images/items/16/medium.png"><div role="group" class="stats"><div class="stat"><i class="bonus-attachment-item-damage-bonus"></i><span>75.54</span></div><div class="stat"><i class="bonus-attachment-item-accuracy-bonus"></i><span>47.32</span></div></div><i data-bonus-attachment-title="Deadeye" data-bonus-attachment-description="28% increased critical hit damage"></i>';
  const filters='<div class="tableWrapper"><ul><li id="a"><a href="/profiles.php?XID=101">Alice</a><div class="ffscouter-bubble">2.88</div><div class="ffscouter-arrow"></div></li><li id="b" data-ff-value="1.73" data-est-value="20000000"><a href="/profiles.php?XID=102">Bob</a><div class="ffscouter-bubble">20.00M</div></li><li id="c"><a href="/profiles.php?XID=103">Carol</a></li></ul></div>';
  await page.route('https://www.torn.com/**',route=>{
   const {pathname,search}=new URL(route.request().url());
   const body=search.includes('sid=list')?filters:pathname==='/factions.php'?'<section id="faction-armoury"><hr><ul class="item-list"><li data-itemid="16">'+item+'</li></ul></section>':pathname==='/item.php'?'<section><div class="equipped-items-wrap"></div><ul class="item-list"><li data-itemid="16">'+item+'</li></ul></section>':search.includes('ItemMarket')?'<li><div class="itemTile___gJeSo">'+item+'</div></li>':'<div data-testid="item">'+item+'<div data-testid="description"></div></div>';
   return route.fulfill({contentType:'text/html',body:'<!doctype html><style>.stats{display:flex}.stat{width:40px;text-align:center}.stat i{display:block}li{list-style:none}img{width:12px}</style><main id="mainContainer">'+body+'</main>'});
  });
  await page.addInitScript(()=>{
   window.calls=[];
   window.SLINK_EXTENSION={core:{storage:{get:async()=>({token:'test',expiresAt:Date.now()+10000,userId:3853023}),fullKey:k=>k},messaging:{send:async(name,payload)=>{
    calls.push([name,payload]);
    return name==='qol.weaponMerits'?{levels:{smg:4},classes:{16:'smg'}}:name==='qol.weaponExperience'?{16:50}:{101:{ff:1.5,stats:5e6}};
   }}}};
  });
  const add=name=>page.addScriptTag({path:source(name)});
  await page.goto('https://www.torn.com/page.php?sid=list&type=targets');await add('followup-filter');
  await page.getByRole('button',{name:'Filter targets',exact:true}).click();
  await page.getByLabel('Fair Fight min',{exact:true}).fill('2.5');
  await page.locator('#b').waitFor({state:'hidden'});
  await page.locator('#c').waitFor({state:'hidden'});
  assert.equal(await page.locator('#a').isVisible(),true);
  assert.ok(!(await page.evaluate(()=>calls.some(([n,p])=>p?.ids.includes('101')))));
  await page.getByRole('button',{name:'Reset',exact:true}).click();
  await page.getByLabel('Battle-stat estimate min',{exact:true}).fill('10000000');
  await page.locator('#a').waitFor({state:'hidden'});
  assert.equal(await page.locator('#b').isVisible(),true);
  await page.locator('#b').evaluate(el=>{el.dataset.estValue='20000';el.querySelector('.ffscouter-bubble').textContent='20.00K';});
  await page.locator('#b').waitFor({state:'hidden'});
  for(const url of ['factions.php?step=your#/tab=armoury','item.php']){
   await page.goto('https://www.torn.com/'+url);
   for(const n of ['followup-components','weapon-merits','followup-mastery','followup-details'])await add(n);
   await page.locator('[data-slink-weapon-xp]').last().waitFor();
   assert.deepEqual(await page.locator('[data-slink-weapon-xp]').allTextContents(),['+5%','+1']);
   assert.deepEqual(await page.locator('[data-slink-weapon-merit]').allTextContents(),['+4%','+0.8']);
   assert.equal(await page.locator('[data-slink-weapon-details]').textContent(),'Deadeye 28%');
   for(const cell of await page.locator('.stat').all()){
    const [a,b]=await Promise.all([cell.boundingBox(),cell.locator('.slink-weapon-modifiers').boundingBox()]);
    assert.ok(b.x>=a.x&&b.x+b.width<=a.x+a.width);
   }
  }
  for(const url of ['bazaar.php?userId=100','page.php?sid=ItemMarket']){
   await page.goto('https://www.torn.com/'+url);
   await add('followup-components');await add('followup-details');
   assert.equal(await page.locator('[data-slink-weapon-details]').textContent(),'Deadeye 28%');
   assert.deepEqual(await page.evaluate(()=>calls),[]);
  }
  for(const ui of ['followup-extension-ui']){
   await page.goto('https://www.torn.com/item.php');
   for(const file of ['followup-components','qol',ui])await add(file);
   await page.evaluate(async()=>{
    window.saved=0;window.used=0;
    const settings={enabled:true,quickItems:true,favorites:[{source:'inventory',id:'heal-exit',name:'Heal out of hospital'}]};
    window.controller=SLINK_QOL_UI.create({active:()=>true,load:async()=>({allowed:true,settings}),save:async()=>{saved++;},use:async()=>{used++;}});
    await controller.sync();
   });
   const tile=page.locator('.slink-qol-tile');
   await tile.getByRole('button',{name:/Remove/}).waitFor();
   const use=await tile.locator('[data-qol-use]').boundingBox(),x=await tile.getByRole('button',{name:/Remove/}).boundingBox();
   assert.ok(x.x>=use.x&&x.x+x.width<=use.x+use.width&&x.y>=use.y&&x.y+x.height<=use.y+use.height);
   await tile.getByRole('button',{name:/Remove/}).click();
   await tile.waitFor({state:'detached'});
   assert.deepEqual(await page.evaluate(()=>[saved,used]),[1,0]);
  }
  assert.deepEqual(errors,[]);
  console.log('Passed: visible FF/stat filters, live badge updates, stacked weapon stat modifiers, local-only market perks, and Quick Use removal.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});

