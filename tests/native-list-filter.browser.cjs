const assert=require('node:assert/strict'),path=require('node:path');
const {chromium}=require(process.env.SLINK_PLAYWRIGHT_MODULE||'playwright');
const rows='<li><a href="/profiles.php?XID=123">Alice</a><div class="position"><span class="ellipsis">Officer</span></div></li><li><a href="/profiles.php?XID=456">Bob</a><div class="position">Member</div></li>';
const roster='<div class="members-list"><ul class="table-body">'+rows+'</ul></div>';
(async()=>{
 const browser=await chromium.launch({channel:'msedge'});
 try{for(const width of [390,1100]){
   const page=await browser.newPage({viewport:{width,height:800}});
   await page.route('https://www.torn.com/**',r=>r.fulfill({contentType:'text/html',body:'<main id="mainContainer"><div class="faction-info-wrap">'+roster+'</div></main>'}));
   const install=()=>page.addScriptTag({path:path.join(__dirname,'../src/content/native-list-filter.js')});
   const visible=(count)=>page.waitForFunction(n=>document.querySelectorAll('.table-body li:not([data-slink-faction-filtered])').length===n,count);
   const field=page.getByRole('searchbox');
   await page.goto('https://www.torn.com/factions.php?step=your');await install();
   await page.getByRole('button',{name:'Filter members',exact:true}).click();
   await field.fill('ali');await visible(1);assert.equal(await page.locator('li:visible').innerText(),'Alice\nOfficer');
   await field.fill('[456]');await page.locator('li:visible').filter({hasText:'Bob'}).waitFor();await visible(1);
   await page.getByRole('combobox').selectOption('Officer');await visible(0);
   await page.getByRole('button',{name:'Reset',exact:true}).click();await visible(2);
   await page.getByRole('combobox').selectOption('Officer');await visible(1);
   await page.getByRole('button',{name:'Save preset'}).click();
   await page.reload();await install();await visible(1);
   await page.evaluate(html=>document.querySelector('.members-list').outerHTML=html,roster);await visible(1);
   assert.equal(await field.count(),1);
   await page.getByRole('button',{name:'Hide member filter'}).click();await visible(2);
   await page.close();
 }}finally{await browser.close();}
 console.log('Faction filter passed: desktop and mobile layout, name/ID/role, empty/reset, preset, replaced roster and disabled state');
})().catch(e=>{console.error(e);process.exitCode=1;});
