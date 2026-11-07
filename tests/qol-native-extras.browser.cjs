const assert=require('node:assert/strict'),path=require('node:path');
const {chromium}=require(process.env.SLINK_PLAYWRIGHT_MODULE||'playwright');
const stock='<main id="stockmarketroot"><ul id="AAA" class="stock___x"><li class="stockName___x">Alpha</li><li><p class="count___x">1,000</p></li></ul><ul id="BBB" class="stock___x"><li class="stockName___x">Beta</li><li><p class="count___x">None</p></li></ul></main>';
const fixtures={
 'amarket.php':'<div class="tabContent" aria-hidden="false"><ul class="items-list"><li id="1"><span class="item-name">Sword</span><i class="item-plate red"></i></li><li id="2"><span class="item-name">Knife</span><i class="item-plate yellow"></i></li></ul></div>',
 'factions.php?step=your':'<div class="descriptions"><div class="faction-war"><div class="enemy-faction">Them</div><ul class="members-list"><li class="your"><a href="/profiles.php?XID=1">Alice</a><span class="level">20</span></li><li class="enemy"><a href="/profiles.php?XID=2">Bob</a><span class="level">80</span></li></ul></div></div>',
 'page.php?sid=racing':'<div class="custom-events-wrap"><ul class="events-list"><li class="protected"><div class="event-wrap"><b class="name">Private race</b><span class="laps">10 laps</span></div></li><li><div class="event-wrap"><b class="name">Open race</b><span class="laps">20 laps</span></div></li></ul></div>',
 'companies.php':'<form action="stock"><div class="storage-capacity"><i data-initial="10"></i><i data-initial="110"></i></div><ul class="stock-list"><li><span class="sold-daily">25</span><input value="7"></li><li><span class="sold-daily">75</span><input value="4"></li><li class="total"><span class="sold-daily">100</span></li></ul><button>Order</button></form>',
 'profiles.php?XID=123':'<div class="profile-left-wrapper"><div class="user-info-value"><a href="/factions.php?step=profile&ID=99">Faction</a></div><a href="/page.php?sid=attack&user2ID=123">Attack</a></div>',
 'page.php?sid=stocks':stock
};
(async()=>{
 const browser=await chromium.launch({channel:'msedge'});
 try{for(const width of [390,1100]){
   const page=await browser.newPage({viewport:{width,height:800}});
   await page.route('https://www.torn.com/**',r=>r.fulfill({contentType:'text/html',body:'<div id="mainContainer">'+fixtures[r.request().url().split('www.torn.com/')[1]]+'</div>'}));
   await page.addInitScript(()=>{window.SLINK_EXTENSION={core:{storage:{get:async(key,fallback)=>key==='access.session.v1'?{token:'fixture',expiresAt:Date.now()+5000,factionId:99}:fallback}}};});
   const open=async(url,file='qol-native-extras.js')=>{await page.goto('https://www.torn.com/'+url);if(url.includes('sid=stocks'))await page.addScriptTag({path:path.join(__dirname,'../src/core/stocks-preview.js')});await page.addScriptTag({path:path.join(__dirname,'../src/content/'+file)});};
   await open('amarket.php');await page.getByText('Filter auctions',{exact:true}).click();
   await page.getByLabel('Ranked tier').selectOption('red');await page.getByText('Knife',{exact:true}).waitFor({state:'hidden'});
   await open('factions.php?step=your');await page.getByText('Filter ranked war members').click();
   await page.getByLabel('War side').selectOption('enemy');await page.getByText('Alice',{exact:true}).waitFor({state:'hidden'});
   await open('page.php?sid=racing');await page.getByText('Filter custom races').click();
   await page.getByRole('checkbox',{name:'No password'}).check();await page.getByText('Private race',{exact:true}).waitFor({state:'hidden'});
   await open('companies.php');await page.getByRole('button',{name:'Suggest stock order'}).click();
   await page.getByText('Suggested: 75',{exact:true}).waitFor();assert.equal(await page.locator('form input').first().inputValue(),'7');
   await page.getByRole('button',{name:'Suggest stock order'}).click();await page.getByText('Suggested: 25',{exact:true}).waitFor();
   await page.locator('.storage-capacity > i').first().evaluate(n=>n.dataset.initial='50');await page.getByText('Stock data changed.',{exact:false}).waitFor();
   await open('profiles.php?XID=123');await page.getByText('Warning: this player is in your faction.').waitFor();assert.equal(await page.getByRole('link',{name:'Attack'}).count(),1);
   await open('page.php?sid=stocks','stocks-preview.js');await page.getByLabel('Stock ownership').selectOption('owned');
   await page.getByText('Beta',{exact:true}).waitFor({state:'hidden'});
   await page.getByLabel('Stock ownership').selectOption('');await page.getByLabel('Stock name or symbol').fill('BBB');
   await page.getByText('Alpha',{exact:true}).waitFor({state:'hidden'});await page.getByText('Beta',{exact:true}).waitFor();
   await page.close();
 }}finally{await browser.close();}
 console.log('Auction, war, races, stock filters, friendly-fire advisory, and company stock suggestions passed');
})().catch(e=>{console.error(e);process.exitCode=1;});
