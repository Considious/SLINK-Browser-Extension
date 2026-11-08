const fs=require('node:fs'),assert=require('node:assert/strict');
const {chromium}=require(process.env.SLINK_PLAYWRIGHT_MODULE || 'playwright');
(async()=>{
 const browser=await chromium.launch(process.env.SLINK_BROWSER_EXECUTABLE?{executablePath:process.env.SLINK_BROWSER_EXECUTABLE}:{channel:'msedge'});
 try{for(const width of [380,1000]){
  const page=await browser.newPage({viewport:{width,height:850}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('https://www.torn.com/**',route=>route.fulfill({contentType:'text/html',body:`<html><head></head><body><aside id="sidebar"></aside><main id="mainContainer" class="content-wrapper" role="main"><ul><li data-item="206" data-category="Drug"><span class="name">Xanax</span><span class="qty">5</span></li><li data-item="733" data-category="Medical"><span class="name">Blood Bag : A+</span><span class="qty">10</span></li></ul></main><div id="manager"></div></body></html>`}));
  await page.goto('https://www.torn.com/item.php');await page.bringToFront();await page.context().addCookies([{name:'rfc_v',value:'test',url:'https://www.torn.com'}]);
  for(const file of ['qol-core.js','qol-ui.js'])await page.addScriptTag({content:fs.readFileSync(__dirname+'/../src/core/'+(file==='qol-core.js'?'qol.js':'qol-ui.js'),'utf8')});
  await page.evaluate(()=>{
    window.saved={bloodType:'A+',favorites:[]};window.writes=0;window.requests=[];window.profileCalls=0;
    window.fetch=async(url,options)=>{requests.push({url,body:options.body});return {ok:true,text:async()=>JSON.stringify({success:true,text:'You used one item.'})};};
    const data={catalog:{items:[{id:206,name:'Xanax',type:'Drug',effect:'Gives 250 energy',price:800000},{id:733,name:'Blood Bag : A+',type:'Medical',price:30000}]},perks:{perks:{faction:['30% extra medical effectiveness'],education:['20% bonus to medical effectiveness']}},perksAt:Date.now(),catalogAt:Date.now(),profileAt:Date.now()};
    window.controller=SLINK_QOL_UI.create({version:'0.19.64',product:'extension',load:async()=>({allowed:true,settings:saved}),save:async value=>{writes++;saved=structuredClone(value);await new Promise(r=>setTimeout(r,15));},cached:async()=>data,info:async()=>data,profile:async()=>{profileCalls++;return {life:{current:10,maximum:100}};},updates:async()=>({schema:1,extension:{version:'0.19.63'}})});
    controller.mount(document.getElementById('manager'));return controller.sync();
  });
  await page.getByRole('button',{name:'Add Xanax to SLINK quick use',exact:true}).click();
  await page.getByRole('button',{name:'Add Blood Bag : A+ to SLINK quick use',exact:true}).click();
  await page.waitForFunction(()=>saved.favorites.length===2);
  await page.locator('#manager .slink-qol-row').filter({hasText:'Blood Bag : A+ · inventory'}).getByRole('button',{name:'Move up'}).click();
  await page.waitForFunction(()=>saved.favorites[0].id==='733');
  await page.getByRole('button',{name:'Xanax ×5',exact:true}).evaluate(button=>{
    window.originalFavorite=button;
    button.closest('section').parentElement.append(document.createElement('aside'));
  });
  await page.waitForTimeout(200);
  assert.equal(await page.getByRole('button',{name:'Xanax ×5',exact:true}).evaluate(button=>window.originalFavorite===button),true,'Unrelated page edits must not replace favorites');
  await page.getByRole('button',{name:'Xanax ×5',exact:true}).click();await page.waitForFunction(()=>requests.length===1);
  assert.match((await page.evaluate(()=>requests[0].body)),/step=useItem/);
  await page.waitForTimeout(250);assert.equal(await page.evaluate(()=>requests.length),1,'no auto-repeat');
  await page.getByRole('button',{name:'Add link',exact:true}).click();await page.getByRole('textbox',{name:'Link name'}).fill('My faction');await page.getByRole('textbox',{name:'Link URL'}).fill('https://www.torn.com/factions.php');await page.getByRole('button',{name:'Save link',exact:true}).click();
  await page.waitForFunction(()=>saved.links.length===1);await page.getByRole('navigation',{name:'SLINK custom links'}).getByRole('link',{name:'My faction'}).waitFor();
  const start=await page.evaluate(()=>writes);await page.waitForTimeout(450);assert.equal(await page.evaluate(()=>writes),start,'no observer-induced saves');
  await page.evaluate(()=>controller.stop());assert.equal(await page.locator('section[aria-label="SLINK quick use"]').count(),0);assert.deepEqual(errors,[]);
  await page.close();console.log('Browser UI passed at '+width+'px');
 }
 const armory=await browser.newPage({viewport:{width:390,height:850}});
 await armory.route('https://www.torn.com/**',r=>r.fulfill({contentType:'text/html',body:`<aside id="sidebar"></aside><main id="mainContainer" role="main" class="content-wrapper"><div class="armoury-points-wrap"><a class="give" data-role="refill">Refill</a></div><div class="armoury-tabs"><ul class="item-list"><li><div class="img-wrap" data-itemid="731"></div><span class="name">Blood Bag : O-</span><span class="qty">200</span></li><li><div class="img-wrap" data-itemid="733"></div><span class="name">Blood Bag : A+</span><span class="qty">100</span></li><li><div class="img-wrap" data-itemid="735"></div><span class="name">Blood Bag : B+</span><span class="qty">80</span></li></ul></div></main><div id="manager"></div>`}));
 await armory.goto('https://www.torn.com/factions.php#/tab=armoury');await armory.bringToFront();await armory.context().addCookies([{name:'rfc_v',value:'test',url:'https://www.torn.com'}]);
 for(const file of ['qol-core.js','qol-ui.js'])await armory.addScriptTag({content:fs.readFileSync(__dirname+'/../src/core/'+(file==='qol-core.js'?'qol.js':'qol-ui.js'),'utf8')});
 await armory.evaluate(()=>{
  window.requests=[];window.saved={bloodType:'A+',favorites:[{source:'armory',id:'blood-heal',name:'Best compatible blood bag'},{source:'armory',id:'blood-hospital',name:'Self-hospitalize with blood'},{source:'armory',id:'points-energy',name:'Energy refill'}]};
  window.fetch=async(url,o)=>{requests.push({url,body:o.body});return {ok:true,text:async()=>JSON.stringify({success:true,message:'Done'})};};
  const cached={perks:{perks:{faction:[],education:[]}},perksAt:Date.now(),catalog:{items:[{id:731,name:'Blood Bag : O-',type:'Medical',price:1},{id:733,name:'Blood Bag : A+',type:'Medical',price:30},{id:735,name:'Blood Bag : B+',type:'Medical',price:10}]}};
  window.c=SLINK_QOL_UI.create({product:'pda',version:'0.4.190',load:async()=>({allowed:true,settings:saved}),save:async v=>saved=v,cached:async()=>cached,updates:async()=>({schema:1})});return c.sync();
 });
 await armory.getByRole('button',{name:'Best compatible blood bag',exact:true}).click();await armory.waitForFunction(()=>requests.length===1);assert.match(await armory.evaluate(()=>requests[0].body),/itemID=733/,'preserve O bags');
 await armory.getByRole('button',{name:'Self-hospitalize with blood',exact:true}).click();await armory.waitForFunction(()=>requests.length===2);assert.match(await armory.evaluate(()=>requests[1].body),/itemID=735/,'incompatible bag only');
 await armory.getByRole('button',{name:'Energy refill',exact:true}).click();await armory.waitForFunction(()=>requests.length===3);assert.match(await armory.evaluate(()=>requests[2].body),/step=armouryRefillEnergy/);
 await armory.waitForTimeout(500);assert.equal(await armory.evaluate(()=>requests.length),3);await armory.close();console.log('Armory blood selection, self-hospitalizing and points refill checks passed');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
