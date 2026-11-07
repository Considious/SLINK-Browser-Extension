const assert=require('node:assert/strict'),path=require('node:path');
const {chromium}=require(process.env.SLINK_PLAYWRIGHT_MODULE||'playwright');
const script='../src/content/weapon-details.js';
require(script);
const {experience,xpText,bonusText}=globalThis.SLINK_WEAPON_DETAILS;
assert.deepEqual(experience({weaponexp:[{id:1,exp:50},{id:2,exp:null},{id:3,exp:101}]}),{1:50});
assert.equal(xpText(50),'XP 50% · +5.0% damage · +1.00 accuracy');
assert.equal(bonusText('<b>Revitalize</b><br/>Restores energy'), 'Revitalize — Restores energy');
const image='<figure><img src="/images/items/1/large.png"></figure>';
const inventory='<main id="mainContainer"><ul><li data-item="1">'+image+'<ul class="bonuses"><li class="bonus"><i class="bonus-attachment-revitalize" title="&lt;b&gt;Revitalize&lt;/b&gt;&lt;br/&gt;Restores energy"></i></li></ul></li><li data-item="2">Unknown weapon</li></ul></main>';
const attack='<main id="attack-root"><div id="weapon_main" aria-describedby="label_attacker_primary">'+image+'</div><div id="weapon_main" aria-describedby="label_defender_primary">'+image+'</div></main>';
(async()=>{
 const browser=await chromium.launch({channel:'msedge'});
 try{for(const pda of [false,true]){
   const page=await browser.newPage({viewport:{width:pda?390:1100,height:800}});
   await page.route('https://www.torn.com/**',r=>r.fulfill({contentType:'text/html; charset=utf-8',body:r.request().url().includes('sid=attack')?attack:inventory}));
   await page.addInitScript(pda=>{
     window.requests=0;
     if(pda)window.SLINK_PDA_PLUGIN_API={accountId:()=>12,tornJson:async()=>{window.requests++;return {weaponexp:[{id:1,exp:50}]};}};
     else window.SLINK_EXTENSION={core:{storage:{get:async()=>({userId:12,token:'x',expiresAt:Date.now()+60000})},messaging:{send:async()=>{window.requests++;return {1:50};}}}};
   },pda);
   const open=async url=>{await page.goto('https://www.torn.com/'+url);await page.addScriptTag({path:path.join(__dirname,script)});};
   await open('item.php');
   await page.getByRole('button',{name:'Explain special bonuses'}).click();
   await page.getByText('Revitalize — Restores energy',{exact:true}).waitFor();
   assert.equal(await page.evaluate(()=>window.requests),0);
   await page.getByRole('button',{name:'Show weapon XP'}).click();
   await page.getByText(xpText(50),{exact:true}).waitFor();
   assert.equal(await page.locator('li[data-item="2"] [data-slink-weapon-details]').count(),0);
   await page.getByRole('button',{name:'Hide bonus explanations'}).click();
   await page.getByText('Revitalize — Restores energy',{exact:true}).waitFor({state:'detached'});
   await open('page.php?sid=attack&user2ID=99');
   await page.getByRole('button',{name:'Show weapon XP'}).click();
   await page.getByText('XP 50%',{exact:true}).waitFor();
   assert.equal(await page.locator('[aria-describedby*="defender_"] [data-slink-weapon-details]').count(),0);
   await page.close();
 }}finally{await browser.close();}
 console.log('Weapon details: opt-in XP, native tooltip explanations, and own weapons only in combat passed');
})().catch(e=>{console.error(e);process.exitCode=1;});
