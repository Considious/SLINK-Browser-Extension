const assert=require('node:assert/strict'),path=require('node:path');
const {chromium}=require(process.env.SLINK_PLAYWRIGHT_MODULE||'playwright');
const row=(id,name,ranked,prof)=>'<li><span class="name">'+name+'</span><div class="loaned"><a href="/profiles.php?XID='+id+'">Borrower '+id+'</a></div><div class="img-wrap"><img class="torn-item '+(ranked?'glow-yellow':'')+'"></div>'+(prof?'<i class="bonus-attachment-experience"></i>':'')+'<div class="item-action"><button data-role="retrieve" class="active" onclick="this.dataset.opens=(Number(this.dataset.opens)||0)+1;this.closest(\'li\').querySelector(\'.retrieve-cont\').hidden=false">Retrieve</button></div><div class="retrieve-cont" hidden><button class="retrieve-yes" onclick="this.dataset.confirmed=1;this.closest(\'li\').remove()">Yes</button></div></li>';
(async()=>{
 const browser=await chromium.launch({channel:'msedge'});
 try{for(const pda of [false,true]){
   const page=await browser.newPage({viewport:{width:pda?390:1100,height:800}});
   await page.route('https://www.torn.com/**',r=>r.fulfill({contentType:'text/html',body:'<main id="mainContainer"><div id="tab=armoury&sub=weapons"><ul class="item-list">'+row(1,'Protected',true,false)+row(2,'Proficient',true,true)+row(3,'Regular',true,false)+row(4,'Unranked',false,false)+'</ul></div></main>'}));
   await page.addInitScript(pda=>{
     window.allowed=false;
     const prefs={owner:'12:34',mode:'ranked-all',protectedIds:['1'],members:[{id:'2',name:'Borrower 2',level:20,rank:'Officer'}]};
     if(pda)window.SLINK_PDA_PLUGIN_API={armoryFilter:{read:()=>window.allowed?prefs:null,save:async(k,v)=>{prefs[k==='protected'?'protectedIds':k]=v;},load:async()=>prefs.members}};
     else window.SLINK_EXTENSION={core:{permissions:{hasScope:()=>window.allowed},storage:{
       get:async(k,d)=>({'access.session.v1':{userId:12,factionId:34,token:'test',expiresAt:Date.now()+10000},'war.armory.mode.v1':prefs.mode,'war.armory.whitelist.v1':prefs.protectedIds,'war.armory.memberCache.v1':{owner:prefs.owner,members:prefs.members}})[k]??d,
       set:async(k,v)=>{if(k==='war.armory.mode.v1')prefs.mode=v;}
     }}};
   },pda);
   await page.goto('https://www.torn.com/factions.php?step=your#/tab=armoury&sub=weapons');
   await page.addScriptTag({path:path.join(__dirname,'../src/content/armory-filter.js')});
   const panel=page.getByText('Armory filter & recaller',{exact:true});
   await page.evaluate(()=>new Promise(requestAnimationFrame));assert.equal(await panel.count(),0);
   await page.evaluate(()=>{window.allowed=true;window.dispatchEvent(new Event('focus'));});
   await panel.click();
   await page.getByLabel('Show recall candidates only',{exact:true}).check();
   await page.getByLabel('Recall mode',{exact:true}).selectOption('ranked-no-prof');
   const regular=page.locator('li').filter({hasText:'Regular'}), prof=page.locator('li').filter({hasText:'Proficient'});
   await prof.waitFor({state:'hidden'});
   await page.getByRole('button',{name:'Recall next',exact:true}).click();
   await regular.getByRole('button',{name:'Yes',exact:true}).waitFor();
   assert.equal(await page.locator('[data-opens]').count(),1);
   await page.getByRole('button',{name:'Recall next',exact:true}).click();
   await page.getByText('Finish or cancel the open Torn recall first.').waitFor();
   assert.equal(await regular.getByRole('button',{name:'Retrieve',exact:true}).getAttribute('data-opens'),'1');
   assert.equal(await page.locator('[data-confirmed]').count(),0);
   await page.evaluate(()=>{window.allowed=false;window.dispatchEvent(new Event('focus'));});
   await panel.waitFor({state:'detached'});
   assert.equal(await page.locator('[data-slink-armory-filtered]').count(),0);
   await page.close();
 }}finally{await browser.close();}
 console.log('Native Armory filter: officer-only, ranked mode, whitelist, one prompt, manual confirmation, and revocation passed');
})().catch(e=>{console.error(e);process.exitCode=1;});
