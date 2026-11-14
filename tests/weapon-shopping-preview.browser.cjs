const assert=require('node:assert/strict'),path=require('node:path');
const {chromium}=require(process.env.SLINK_PLAYWRIGHT_MODULE||'playwright');
(async()=>{
 const browser=await chromium.launch({channel:'chrome'});
 try{
  const page=await browser.newPage({viewport:{width:380,height:760}});
  page.setDefaultTimeout(4500);
  const image=id=>'<img class="torn-item" src="/images/items/'+id+'/large.png">';
  const icon=stat=>'<i class="bonus-attachment-item-'+stat+'-bonus"></i>';
  const parts=['damage','accuracy'];
  const values=['54.23','45.57'];
  const legacy='<ul class="item-list"><li data-item="484"><ul class="bonuses-wrap">'+parts.map((k,i)=>'<li class="native-cell '+k+'">'+icon(k)+'<span>'+values[i]+'</span></li>').join('')+'</ul></li></ul>';
  const market='<ul><li><div class="itemTile___gJeSo"><div class="baseItemTileWrapper___tV9VZ"><div class="tileImage___mbztJ">'+image(487)+'</div><div class="properties___PToF_">'+parts.map((k,i)=>'<div class="property___N9Q3E"><span class="icon___grIJv"><svg></svg></span><span class="value___lf6FF" aria-label="'+values[i]+' '+k+' points"><span aria-hidden="true">'+values[i]+'</span></span></div>').join('')+'</div></div><div class="title___nHwkf"><div>Thompson</div><span>$970</span></div></div></li></ul>';
  const bazaar='<div data-testid="item"><div data-testid="item-description"><div class="imgBar___H65Bf"><div data-testid="img-container">'+image(244)+'</div><div class="infoBonuses___SQF19">'+parts.map((k,i)=>'<div class="container___tlL_q">'+icon(k)+'<span class="t-overflow">'+values[i]+'</span></div>').join('')+'</div><i data-bonus-attachment-title="Poison" data-bonus-attachment-description="87% chance to Poison"></i></div><div data-testid="description"><p>Blowgun</p><div data-testid="price">$8,520</div></div></div></div>';
  await page.route('https://www.torn.com/**',r=>{
   const url=r.request().url();
   const body=url.includes('ItemMarket')?market:url.includes('bazaar.php')?bazaar:url.includes('factions.php')?'<section id="faction-armoury"><hr>'+legacy+'</section>':'<section><div class="equipped-items-wrap"></div>'+legacy+'</section>';
   return r.fulfill({contentType:'text/html',body:'<!doctype html><style>body{font:12px Arial}.native-cell{display:inline-block;width:42px;height:32px;white-space:nowrap;line-height:32px}.native-cell i{display:inline-block;width:12px;height:10px}.native-cell > span{line-height:32px}img{width:16px}</style><main id="mainContainer">'+body+'</main>'});
  });
  await page.addInitScript(()=>{
   window.SLINK_EXTENSION={core:{storage:{get:async()=>({token:'x',userId:1,expiresAt:Date.now()+60000}),fullKey:k=>k},messaging:{send:async(action)=>action==='qol.weaponExperience'?{484:70,487:70,244:50}:{levels:{smg:4,piercing:2},classes:{484:'smg',487:'smg',244:'piercing'}}}}};
  });
  for(const end of ['item.php','factions.php#/tab=armoury','page.php?sid=ItemMarket','bazaar.php?userId=10']){
   await page.goto('https://www.torn.com/'+end);
   for(const n of ['shop-components','weapon-merits','shop-details','shop-mastery'])await page.addScriptTag({path:path.join(__dirname,'../src',({'shop-components':'core/torn-components','weapon-merits':'core/weapon-merits','shop-details':'content/weapon-details','shop-mastery':'content/weapon-merits'})[n]+'.js')});
   await page.locator('[data-slink-weapon-merit]').last().waitFor();
   await page.locator('[data-slink-weapon-xp]').last().waitFor();
   const isBaz=end.includes('bazaar.php'),isMarket=end.includes('ItemMarket');
   assert.deepEqual(await page.locator('[data-slink-weapon-xp]').allTextContents(),isBaz?['+5%','+1']:['+7%','+1.4']);
   assert.deepEqual(await page.locator('[data-slink-weapon-merit]').allTextContents(),isBaz?['+2%','+0.4']:['+4%','+0.8']);
   if(isBaz||isMarket){
    assert.equal(await page.locator('[data-slink-market-weapon-preview]').count(),1);
    await page.getByText(isBaz?'$8,520':'$970',{exact:true}).waitFor();
    if(isBaz)await page.getByText('Poison 87%',{exact:true}).waitFor();
   }else{
    for(const cell of await page.locator('.native-cell').all())assert.ok(await cell.evaluate(el=>{
     const bounds=el.getBoundingClientRect(),value=document.createRange();
     value.selectNode(el.querySelector('.slink-weapon-stat').firstChild);
     const group=el.querySelector('.slink-weapon-modifiers'),groupBounds=group.getBoundingClientRect();
     const gap=groupBounds.top-value.getBoundingClientRect().bottom;
     return parseFloat(getComputedStyle(group).fontSize)>=11&&gap>=-3&&gap<=3&&
       [...group.children,value].every(n=>{const r=n.getBoundingClientRect();return r.left>=bounds.left-.5&&r.right<=bounds.right+.5&&r.bottom<=bounds.bottom+.5;});
    }),'Readable compact stat cells: '+end);
   }
  }
  console.log('Passed: readable tight cells, real Thompson aria-label properties, and Blowgun bazaar preview without price/perk changes.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});

