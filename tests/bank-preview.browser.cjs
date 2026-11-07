const assert=require('node:assert/strict');
const path=require('node:path');
const {chromium}=require(process.env.SLINK_PLAYWRIGHT_MODULE||'playwright');
(async()=>{
 const browser=await chromium.launch({channel:'msedge'});
 try{for(const pda of [false,true]){
  const page=await browser.newPage({viewport:{width:pda?390:1100,height:800}});
  await page.route('https://www.torn.com/**',r=>r.fulfill({contentType:'text/html',body:'<main id="mainContainer"><form><input id="native" value="123"><button>Invest</button></form></main>'}));
  await page.goto('https://www.torn.com/city.php#/p=bank');
  await page.evaluate(()=>{window.loads=0;window.submits=0;document.addEventListener('submit',e=>{e.preventDefault();window.submits++;});window.SLINK_EXTENSION={core:{},define(ns,id,value){this[ns][id]=value;}};});
  await page.addScriptTag({path:path.join(__dirname,'../src/core/money-property.js')});
  await page.evaluate(pda=>{
    const compare=SLINK_EXTENSION.core.moneyProperty.bankComparison;
    const load=async()=>{window.loads++;return {rates:{bank:[{days:7,rate:10}]},userMerits:{merits:{upgrades:[{id:42,level:10}]}},meritCatalog:{merits:[{id:42,name:'Bank Interest'}]},userStocks:{stocks:[]},tornStocks:{stocks:[{id:1,acronym:'TCI'}]},fetchedAt:Date.now()};};
    if(pda){delete window.SLINK_EXTENSION;window.SLINK_PDA_BANK_PREVIEW={compare,load};}
    else SLINK_EXTENSION.core.messaging={send:async()=>({planner:await load()})};
  },pda);
  await page.addScriptTag({path:path.join(__dirname,'../src/content/bank-preview.js')});
  const panel=page.getByRole('region',{name:'SLINK Bank comparison'});
  await panel.waitFor();assert.equal(await page.evaluate(()=>loads),0);
  await panel.getByRole('button').click();
  await panel.getByText(/15.00% APR/).waitFor();
  await panel.getByRole('textbox').fill('2000000001');
  await panel.getByText(/whole dollar amount/).waitFor();
  await panel.getByRole('textbox').press('Enter');
  assert.equal(await page.locator('#native').inputValue(),'123');assert.equal(await page.evaluate(()=>submits),0);
  await page.evaluate(()=>location.hash='#/p=map');await panel.waitFor({state:'detached'});
  await page.evaluate(()=>location.hash='#/p=bank');await panel.waitFor();
  assert.equal(await panel.count(),1);await page.close();
 }}finally{await browser.close();}
 console.log('Bank preview: desktop/PDA fixtures, validation, routing and no investment submission passed');
})().catch(e=>{console.error(e);process.exitCode=1;});
