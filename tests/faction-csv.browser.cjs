const assert=require('node:assert/strict'),path=require('node:path');
const {chromium}=require(process.env.SLINK_PLAYWRIGHT_MODULE||'playwright');
const script='../src/core/faction-csv.js';
require(script);
const api=globalThis.SLINK_FACTION_CSV;
assert.equal(api.csv(['Header'],[['=SUM(1,2)'],['A"B'],['\tcmd'],[-2]]),'"Header"\r\n"\'=SUM(1,2)"\r\n"A""B"\r\n"\'\tcmd"\r\n"-2"\r\n');
assert.match(api.officer('armory',[{name:'Morphine',current:4,target:10}],1760000000000,'Offline'),/"Morphine","4","10","6".*Latest check failed/);
assert.match(api.officer('missing',[{crimeId:9,crimeName:'Crime',position:'Guard',userName:'Alice',itemName:'Ladder'}],0,''),/"9","Crime","Guard","","Alice","","Ladder"/);
(async()=>{
 const browser=await chromium.launch({channel:'msedge'});
 try{for(const width of [390,1100]){
   const page=await browser.newPage({viewport:{width,height:800}});
   const roster='<div class="faction-info-wrap"><section class="members-list"><ul class="table-body"><li><a href="/profiles.php?XID=123">Alice</a><div class="lvl">10</div></li><li><a href="/profiles.php?XID=456">Bob</a><div class="lvl">20</div></li></ul></section></div>';
   const war='<div class="descriptions"><div class="faction-war"><div class="enemy-faction">Opponent</div><ul class="members-list"><li class="your"><a href="/profiles.php?XID=1">Alice</a></li><li class="enemy"><a href="/profiles.php?XID=2">Bob</a></li></ul></div></div>';
   await page.route('https://www.torn.com/**',r=>r.fulfill({contentType:'text/html; charset=utf-8',body:'<main id="mainContainer">'+roster+war+'</main>'}));
   await page.goto('https://www.torn.com/factions.php?step=your');await page.addScriptTag({path:path.join(__dirname,script)});
   for(const file of ['native-list-filter','qol-native-extras'])await page.addScriptTag({path:path.join(__dirname,'../src/content/'+file+'.js')});
   await page.getByRole('button',{name:'Filter members',exact:true}).click();await page.getByLabel('Filter members by name or ID').fill('Alice');
   await page.locator('.table-body li').filter({hasText:'Bob'}).waitFor({state:'hidden'});
   await page.getByRole('button',{name:'Export visible members'}).click();
   const member=await page.getByLabel('Export visible members text').inputValue();
   assert.match(member,/"123","Alice"/);assert.doesNotMatch(member,/Bob/);
   await page.getByText('Filter ranked war members').click();await page.getByLabel('War side').selectOption('enemy');
   await page.getByRole('button',{name:'Export visible war roster'}).click();
   const result=await page.getByLabel('Export visible war roster text').inputValue();
   assert.match(result,/"2","Bob","","","Opponent"/);assert.doesNotMatch(result,/Alice/);
   await page.close();
 }}finally{await browser.close();}
 console.log('Faction CSV: visible rows, no SLINK login, spreadsheet safety and stale officer results passed');
})().catch(e=>{console.error(e);process.exitCode=1;});
