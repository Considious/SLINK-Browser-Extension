const assert=require('node:assert/strict'),path=require('node:path');
const {chromium}=require(process.env.SLINK_PLAYWRIGHT_MODULE||'playwright');
(async()=>{
 const browser=await chromium.launch({channel:'chrome'});
 try{
  const page=await browser.newPage({viewport:{width:354,height:750}});
  page.setDefaultTimeout(4500);
  const item='<span class="thumbnail-wrap"><img src="/images/items/484/medium.png" alt="AK74U"></span><div class="title-wrap"><span class="name-wrap"><span class="name">AK74U</span></span></div><div class="cont-wrap"><div class="bonuses"><ul class="bonuses-wrap"><li class="left damage"><i class="bonus-attachment-item-damage-bonus"></i><span>54.23</span></li><li class="left accuracy"><i class="bonus-attachment-item-accuracy-bonus"></i><span>45.57</span></li><li class="bonus left" data-attachments-itemid="15055377720"><i title="&lt;b&gt;Holographic Sight&lt;/b&gt;&lt;br/&gt;+1.25 Accuracy"></i></li><li class="bonus left"><i data-bonusid="114230913" title="&lt;b&gt;Motivation&lt;/b&gt;&lt;br/&gt;16% chance to Motivate"></i></li></ul></div><ul class="actions-wrap"><li data-action="equip" data-item="484"></li></ul></div><div class="view-item-info"></div>';
  const row='<li data-equipped="true" data-item="484" data-armoryid="15055377720" data-category="Primary">'+item+'</li>';
  const roster='<div class="tableWrapper"><ul class="roster"><li id="a"><a href="/profiles.php?XID=101">Alice</a><div class="ffscouter-bubble">1.25</div></li><li id="b"><a href="/profiles.php?XID=102">Bob</a><div class="ffscouter-bubble">2.88</div></li><li id="c"><a href="/profiles.php?XID=103">Carol</a><div class="ffscouter-bubble">1.84</div></li></ul></div>';
  await page.route('https://www.torn.com/**',r=>{
   const url=r.request().url(),html=url.includes('sid=list')?roster:url.includes('item.php')?'<section><div class="equipped-items-wrap"></div><ul class="item-list">'+row+'</ul></section>':url.includes('factions.php')?'<section id="faction-armoury"><hr><ul class="item-list">'+row+'</ul></section>':url.includes('bazaar.php')?'<div data-testid="item">'+row.slice(row.indexOf('>')+1,-5)+'<div data-testid="description"></div></div>':'<div class="itemTile___gJeSo">'+item.replaceAll('data-bonusid="114230913"','data-bonus-attachment-title="Motivation" data-bonus-attachment-description="16% chance to Motivate"')+'</div>';
   return r.fulfill({contentType:'text/html',body:'<!doctype html><style>li{list-style:none}.bonuses-wrap>.left{display:inline-block;height:32px;width:45px}.damage>i,.accuracy>i{display:inline-block;width:12px;height:12px}img{max-width:25px}</style><main id="mainContainer">'+html+'</main>'});
  });
  await page.addInitScript(()=>{
   window.calls=[];
   window.SLINK_EXTENSION={core:{storage:{get:async()=>({token:'x',userId:1,expiresAt:Date.now()+10000}),fullKey:k=>k},messaging:{send:async(name)=>{
    calls.push(name);
    if(name==='qol.weaponExperience')return {484:70};
    if(name==='qol.weaponMerits')return {levels:{smg:4},classes:{484:'smg'}};
    return {101:{stats:1},102:{stats:999999999},103:{stats:9999999999}};
   }}}};
  });
  const files={'real-filter':'content/native-list-filter','real-components':'core/torn-components','weapon-merits':'core/weapon-merits','real-mastery':'content/weapon-merits','real-details':'content/weapon-details'};
  const add=name=>page.addScriptTag({path:path.join(__dirname,'../src',files[name]+'.js')});
  await page.goto('https://www.torn.com/page.php?sid=list&type=targets');
  await page.evaluate(()=>new Promise((resolve,reject)=>{
   const request=indexedDB.open('FFSV3-cache');
   request.onupgradeneeded=()=>request.result.createObjectStore('cache',{keyPath:'player_id'});
   request.onerror=reject;
   request.onsuccess=()=>{
    const db=request.result,tx=db.transaction('cache','readwrite'),s=tx.objectStore('cache'),fresh=Date.now()+60000;
    s.put({player_id:101,source:'premium',available_estimates:{premium:{bs_estimate:20e6}},bs_estimate:10e6,expiry:fresh});
    s.put({player_id:102,bs_estimate:15e6,expiry:fresh});
    s.put({player_id:103,bs_estimate:99e6,expiry:Date.now()-1});
    tx.oncomplete=()=>{db.close();resolve();};tx.onerror=reject;
   };
  }));
  await add('real-filter');
  await page.getByRole('button',{name:'Filter targets',exact:true}).click();
  await page.getByLabel('Sort targets',{exact:true}).selectOption('stats-desc');
  await page.getByLabel('Battle-stat estimate min',{exact:true}).fill('10000000');
  await page.waitForFunction(()=>document.getElementById('a').style.getPropertyValue('--slink-roster-order')==='-2');
  assert.equal(await page.locator('#b').isVisible(),true);
  assert.equal(await page.locator('#c').isVisible(),false);
  assert.deepEqual(await page.evaluate(()=>calls),[]);
  for(const end of ['item.php','factions.php#/tab=armoury','bazaar.php?userId=10','page.php?sid=ItemMarket']){
   await page.goto('https://www.torn.com/'+end);
   for(const file of ['real-components','weapon-merits','real-mastery','real-details'])await add(file);
   await page.getByText('Motivation 16%',{exact:true}).waitFor();
   assert.equal(await page.locator('[data-slink-weapon-details]').textContent(),'Motivation 16%');
   await page.locator('[data-slink-weapon-xp]').last().waitFor();
   assert.deepEqual(await page.locator('[data-slink-weapon-xp]').allTextContents(),['+7%','+1.4']);
   assert.deepEqual(await page.locator('[data-slink-weapon-merit]').allTextContents(),['+4%','+0.8']);
   const outside=await page.locator('.damage').evaluate(el=>{
    const cell=el.getBoundingClientRect();
    const base=el.querySelector('.slink-weapon-stat'),range=document.createRange();range.selectNode(base.firstChild);
    return [range,...el.querySelectorAll('.slink-weapon-modifiers,.slink-weapon-modifiers span')].flatMap(e=>{const p=e.getBoundingClientRect();return p.x>=cell.x-.5&&p.right<=cell.right+.5&&p.y>=cell.y-.5&&p.bottom<=cell.bottom+.5?[]:[[e.textContent||String(e),cell.toJSON(),p.toJSON()]];});
   });assert.deepEqual(outside,[],end+': '+JSON.stringify(outside));
   if(end==='item.php')await page.getByText('AK74U 70%',{exact:true}).waitFor();
  }
  console.log('Pass: exact cached stat sorting, 16% Motivation, 70% XP, Armory damage bounds, Bazaar/Market weapon preview.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});

