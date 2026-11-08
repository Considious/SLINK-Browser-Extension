const assert=require('node:assert/strict'),path=require('node:path');
const {chromium}=require(process.env.SLINK_PLAYWRIGHT_MODULE||'playwright');
(async()=>{
 const browser=await chromium.launch(process.env.SLINK_BROWSER_EXECUTABLE?{executablePath:process.env.SLINK_BROWSER_EXECUTABLE}:{channel:'msedge'});
 try{for(const pda of [false,true]){
  const page=await browser.newPage({viewport:{width:pda?390:1100,height:800}});
  await page.route('https://www.torn.com/**',r=>r.fulfill({contentType:'text/html',body:`<section class="giver-cont-wrap"><div id="mission1"><h2 class="title-black">Show Some Muscle <span>*</span></h2><div class="max-height-fix"><button>Accept</button></div></div></section><p class="total-mission-points">125</p><ul class="rewards-list"><li data-ammo-info='{"points":100,"image":7,"amount":3,"basicType":"Item"}'><div class="act-wrap"><button>Buy</button></div></li></ul>`}));
  await page.goto('https://www.torn.com/page.php?sid=missions');
  await page.evaluate(pda=>{
   window.actions=0;for(const button of document.querySelectorAll('button'))button.addEventListener('click',()=>window.actions++);
   const items=[{id:7,marketPrice:200,priceAvailable:true,priceCheckedAt:Date.now()}];
   if(pda)window.SLINK_PDA_PLUGIN_API={missionPrices:()=>items};
   else window.SLINK_EXTENSION={core:{storage:{get:async()=>({catalog:{items}})}}};
  },pda);
  await page.addScriptTag({path:path.join(__dirname,'../src/content/mission-preview.js')});
  await page.getByText(/SLINK hint: An attack/).waitFor();
  await page.getByText(/enough credits.*\$600.00.*\$6.00 per credit/).waitFor();
  await page.locator('.total-mission-points').evaluate(el=>el.textContent='99');
  await page.getByText(/not enough credits/).waitFor();
  await page.locator('.title-black').evaluate(el=>el.textContent='Unknown contract');
  await page.getByText(/No verified hint/).waitFor();
  await page.locator('[data-ammo-info]').evaluate(el=>el.dataset.ammoInfo='{"points":100,"basicType":"Ammo"}');
  await page.getByText(/no recent comparable market price/).waitFor();
  assert.equal(await page.evaluate(()=>actions),0);await page.close();
 }}finally{await browser.close();}
 console.log('Mission preview: desktop/PDA fixtures, offer changes and no actions passed');
})().catch(e=>{console.error(e);process.exitCode=1;});
