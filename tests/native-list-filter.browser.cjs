const assert=require('node:assert/strict'),path=require('node:path');
const {chromium}=require(process.env.SLINK_PLAYWRIGHT_MODULE||'playwright');
const rows='<li><a href="/profiles.php?XID=123">Alice</a><div class="position"><span class="ellipsis">Officer</span></div><div class="lvl">10</div><div class="status">Okay</div><i title="Online"></i><ul><li id="icon3_fixture"></li></ul></li><li><a href="/profiles.php?XID=456">Bob</a><div class="position">Member</div><div class="lvl">20</div><div class="status">Hospital</div><i title="Offline"></i></li>';
const roster='<div class="members-list"><ul class="table-body">'+rows+'</ul></div>';
(async()=>{
 const browser=await chromium.launch(process.env.SLINK_BROWSER_EXECUTABLE?{executablePath:process.env.SLINK_BROWSER_EXECUTABLE}:{channel:'msedge'});
 try{for(const width of [390,1100]){
   const page=await browser.newPage({viewport:{width,height:800}});
   await page.route('https://www.torn.com/**',r=>r.fulfill({contentType:'text/html',body:'<main id="mainContainer"><div class="faction-info-wrap">'+roster+'</div></main>'}));
   const install=()=>page.addScriptTag({path:path.join(__dirname,'../src/content/native-list-filter.js')});
   await page.addInitScript(()=>{window.SLINK_PDA_PLUGIN_API={factionMemberIntel:()=>({'123':{ff:2.4,stats:10000},'456':{ff:null,stats:20000}})};});
   const visible=(count)=>page.waitForFunction(n=>document.querySelectorAll('.table-body > li:not([data-slink-faction-filtered])').length===n,count);
   const field=page.getByRole('searchbox');
   await page.goto('https://www.torn.com/factions.php?step=your');await install();
   await page.getByRole('button',{name:'Filter members',exact:true}).click();
   await field.fill('ali');await visible(1);assert.match(await page.locator('.table-body > li:visible').innerText(),/^Alice/);
   await field.fill('[456]');await page.locator('.table-body > li:visible').filter({hasText:'Bob'}).waitFor();await visible(1);
   const role=page.getByRole('combobox',{name:'Faction role'});
   await role.selectOption('Officer');await visible(0);
   await page.getByRole('button',{name:'Reset',exact:true}).click();await visible(2);
   await page.getByRole('combobox',{name:'Activity',exact:true}).selectOption('Offline');await visible(1);
   await page.getByRole('combobox',{name:'Status',exact:true}).selectOption('Okay');await visible(0);
   const reset=page.getByRole('button',{name:'Reset',exact:true});
   await reset.click();await visible(2);
   await page.getByLabel('Level min',{exact:true}).fill('15');await visible(1);
   await reset.click();await visible(2);
   await page.getByText('Special flags',{exact:true}).click();
   await page.getByLabel('Is Donator',{exact:true}).selectOption('yes');await visible(1);
   await reset.click();await visible(2);
   const sort=page.getByLabel('Sort members');
   const first=async name=>page.waitForFunction(expected=>{
     const rows=Array.from(document.querySelectorAll('.table-body > li'));
     rows.sort((a,b)=>a.getBoundingClientRect().top-b.getBoundingClientRect().top);
     return rows[0]?.querySelector('a')?.textContent===expected;
   },name);
   await sort.selectOption('level-desc');await first('Bob');
   await sort.selectOption('stats-desc');await first('Bob');
   await sort.selectOption('ff-desc');await first('Alice');
   assert.equal(await page.getByRole('list',{name:'Sorted faction members'}).count(),0);
   assert.equal(await page.locator('.table-body > li').first().locator('a').innerText(),'Alice');
   await page.getByLabel('Fair Fight min',{exact:true}).fill('2');await visible(1);
   await reset.click();await visible(2);await first('Alice');
   assert.equal(await page.locator('[data-slink-roster-sorted]').count(),0);
   await role.selectOption('Officer');await visible(1);
   await page.getByRole('button',{name:'Save preset'}).click();
   await page.reload();await install();await visible(1);
   await page.evaluate(html=>document.querySelector('.members-list').outerHTML=html,roster);await visible(1);
   assert.equal(await field.count(),1);
   await page.getByRole('button',{name:'Hide member filter'}).click();await visible(2);
   await page.locator('.table-body').evaluate(n=>{n.style.minHeight='500px';n.innerHTML=Array.from({length:16},(_,i)=>'<li><a href="/profiles.php?XID='+(i+100)+'">Member '+i+'</a></li>').join('');});
   await page.getByRole('button',{name:'Filter members',exact:true}).click();
   await reset.click();
   const back=page.getByRole('button',{name:'Back to filters'});
   await back.click();
   assert.equal(await page.getByRole('button',{name:'Hide member filter'}).evaluate(n=>n===document.activeElement),true);
   await page.unroute('https://www.torn.com/**');
   const personal='<main id="mainContainer"><div class="tableWrapper"><ul><li><a href="/profiles.php?XID=123">Alice</a><span class="level__x">10</span><img class="userOnlineStatusIcon___x" alt="Online"></li><li><a href="/profiles.php?XID=456">Bob</a><span class="level__x">20</span><img class="userOnlineStatusIcon___x" alt="Offline"></li></ul></div></main>';
   await page.route('https://www.torn.com/**',r=>r.fulfill({contentType:'text/html',body:personal}));
   for(const kind of ['friends','enemies','targets']){
     await page.goto('https://www.torn.com/page.php?sid=list&type='+kind);await install();
     await page.getByRole('button',{name:'Filter '+kind,exact:true}).click();
     const native=page.locator('.tableWrapper > ul > li:visible');
     await page.getByRole('combobox',{name:'Activity',exact:true}).selectOption('Offline');
     await page.getByText('1 of 2 loaded '+kind,{exact:true}).waitFor();
     assert.match(await native.innerText(),/^Bob/);
     await reset.click();
     await page.getByRole('combobox',{name:'Sort '+kind}).selectOption('level-desc');
     await page.waitForFunction(()=>document.querySelector('.tableWrapper > ul > li:last-child').getBoundingClientRect().top<document.querySelector('.tableWrapper > ul > li:first-child').getBoundingClientRect().top);
     assert.equal(await page.locator('.tableWrapper > ul').count(),1);
     await field.fill('Alice');
     await page.getByText('1 of 2 loaded '+kind,{exact:true}).waitFor();
     await page.getByRole('button',{name:'Save preset'}).click();
   }
   await page.unroute('https://www.torn.com/**');
   const directoryRows='<li><a href="/profiles.php?XID=123">Alice</a><div class="info-wrap"><span class="level"><span class="value">10</span></span><span class="time"><i>Ends in</i>1h 25m</span></div><button class="revive reviveNotAvailable" type="button">Revive</button></li><li><a href="/profiles.php?XID=456">Bob</a><div class="info-wrap"><span class="level">20</span><span class="time">45m</span></div><button class="revive" type="button">Revive</button></li>';
   await page.route('https://www.torn.com/**',r=>{
     const userlist=r.request().url().includes('sid=UserList');
     return r.fulfill({contentType:'text/html',body:'<main id="mainContainer"><div class="userlist-wrapper"><ul class="'+(userlist?'user-info-list-wrap':'users-list')+'">'+directoryRows+'<li class="loader"><span class="ajax-preloader">Loading</span></li></ul></div></main>'});
   });
   for(const [url,noun] of [['hospitalview.php','hospital patients'],['jailview.php','jail inmates'],['page.php?sid=UserList','users']]){
     await page.goto('https://www.torn.com/'+url);await install();
     await page.getByRole('button',{name:'Filter '+noun,exact:true}).click();
     const count=page.getByText('1 of 2 loaded '+noun,{exact:true});
     const row=page.locator('.userlist-wrapper ul > li:not(.loader):visible');
     if(noun==='users'){
       await page.getByLabel('Level min',{exact:true}).fill('15');await count.waitFor();
       assert.match(await row.innerText(),/^Bob/);
     }else{
       await page.getByLabel('Time left (min) min',{exact:true}).fill('60');await count.waitFor();
       assert.match(await row.innerText(),/^Alice/);
       await reset.click();
       await page.getByRole('combobox',{name:'Sort '+noun}).selectOption('minutes-asc');
       await page.waitForFunction(()=>document.querySelector('.users-list > li:nth-child(2)').getBoundingClientRect().top<document.querySelector('.users-list > li:first-child').getBoundingClientRect().top);
       if(noun==='hospital patients'){
         await page.getByLabel('Revive availability',{exact:true}).selectOption('yes');await row.filter({hasText:'Bob'}).waitFor();await count.waitFor();assert.match(await row.innerText(),/^Bob/);
       }
     }
     assert.equal(await page.locator('.userlist-wrapper > ul').count(),1);
     assert.equal(await page.locator('.loader').getAttribute('data-slink-faction-filtered'),null);
   }
   await page.unroute('https://www.torn.com/**');
   const travel='<ul class="stockTableWrapper___x"><li><div class="row___x"><span class="itemName___x">Orchid</span><span>Type: Flower</span><span>Cost: $1,000</span><span>Stock: 25</span></div></li><li><div class="row___x"><span class="itemName___x">Bear</span><span>Type: Plushie</span><span>$500</span><span>Stock: 0</span></div></li><li class="purchase"><div class="buyPanel___x">Confirm purchase</div></li></ul>';
   const city='<div class="buy-items-wrap"><ul class="items-list"><li><div class="item" itemid="2"><span class="name">Hammer</span></div><span class="price">$100</span><span class="instock">50</span></li><li><div class="item" itemid="3"><span class="name">Saw</span></div><span class="price">$2,500</span><span class="instock">0</span></li></ul></div>';
   const people='<div class="userlist-wrapper"><ul class="users-list"><li><a href="/profiles.php?XID=123">Alice</a><span class="status"><i></i><span>Okay</span></span></li><li><a href="/profiles.php?XID=456">Bob</a><span class="status"><i></i><span>Hospital</span></span></li></ul></div>';
   await page.route('https://www.torn.com/**',r=>r.fulfill({contentType:'text/html',body:'<main id="mainContainer">'+(r.request().url().includes('sid=travel')?travel:r.request().url().includes('shops.php')?city:people)+'</main>'}));
   await page.goto('https://www.torn.com/index.php?page=people');await install();
   await page.getByRole('button',{name:'Filter people abroad'}).click();
   await page.getByLabel('Status',{exact:true}).selectOption('Hospital');
   await page.getByText('1 of 2 loaded people abroad',{exact:true}).waitFor();
   assert.match(await page.locator('.users-list li:visible').innerText(),/^Bob/);
   for(const [url,item] of [['page.php?sid=travel','Orchid'],['shops.php','Hammer']]){
     await page.goto('https://www.torn.com/'+url);await install();
     await page.getByRole('button',{name:'Filter items',exact:true}).click();
     await page.getByLabel('Minimum stock').fill('1');
     await page.getByText('1 of 2 loaded items',{exact:true}).waitFor();
     await page.locator('li:visible').filter({hasText:item}).waitFor();
     if(item==='Orchid'){
       await page.locator('.purchase:visible').waitFor();
       await reset.click();await page.getByLabel('Item type').selectOption('Plushie');
       await page.locator('li:visible').filter({hasText:'Bear'}).waitFor();
     }
     await page.getByLabel('Max price').fill('50');
     await page.getByText('0 of 2 loaded items',{exact:true}).waitFor();
     await reset.click();await page.getByText('2 of 2 loaded items',{exact:true}).waitFor();
     await page.getByLabel('Minimum stock').fill('1');await page.getByText('1 of 2 loaded items',{exact:true}).waitFor();
     await page.getByRole('button',{name:'Save preset'}).click();
     await page.reload();await install();
     await page.getByText('1 of 2 loaded items',{exact:true}).waitFor();assert.equal(await page.getByLabel('Minimum stock').inputValue(),'1');
   }
   await page.close();
 }}finally{await browser.close();}
 console.log('Native list filters passed on desktop/mobile: roster, personal lists, Hospital, Jail and User List');
})().catch(e=>{console.error(e);process.exitCode=1;});
