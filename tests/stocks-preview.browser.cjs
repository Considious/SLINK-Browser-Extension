const assert=require('node:assert/strict');
const path=require('node:path');
const {chromium}=require(process.env.SLINK_PLAYWRIGHT_MODULE||'playwright');
(async()=>{
 const browser=await chromium.launch({channel:'msedge'});
 try{
  for(const width of [390,1100]){
   const page=await browser.newPage({viewport:{width,height:800}});
   await page.route('https://www.torn.com/**',route=>route.fulfill({contentType:'text/html',body:
    '<main id="stockmarketroot"><article class="stock___a" id="FHG"><span class="stockOwned__a active__a"></span><span class="stockPrice__a"><span class="price__a">$10.00</span></span><div class="stockDropdown__a"><form class="buyBlock__a"><input class="input-money"><button>Buy</button></form><form class="sellBlock__a"><input class="input-money"><button>Sell</button></form></div></article></main>'}));
   await page.goto('https://www.torn.com/page.php?sid=stocks');
   await page.evaluate(()=>{
    window.trades=0;
    document.addEventListener('submit',e=>{e.preventDefault();window.trades++;});
    window.SLINK_EXTENSION={core:{storage:{get:async()=>[],set:async()=>{}},messaging:{send:async()=>({
     holdings:[{id:1,shares:100,transactions:[{shares:100,price:8}]}],market:[{id:1,acronym:'FHG',market:{price:10},bonus:{requirement:100}}],cash:500,fetchedAt:Date.now()
    })}}};
   });
   for(const f of ['core/stocks-preview.js','content/stocks-preview.js'])await page.addScriptTag({path:path.join(__dirname,'../src',f)});
   await page.getByRole('button',{name:'Load / refresh stocks'}).click();
   await page.getByText(/Next benefit: 200/).waitFor();
   const buy=page.locator('.buyBlock__a'),sell=page.locator('.sellBlock__a');
   await buy.getByPlaceholder('e.g. 25,000').fill('100');
   await buy.getByRole('button',{name:'Fill Torn shares'}).click();
   assert.equal(await buy.locator('.input-money').inputValue(),'10');
   await buy.getByPlaceholder('e.g. 25,000').fill('600');
   await buy.getByRole('button',{name:'Fill Torn shares'}).click();
   assert.equal(await buy.locator('.input-money').inputValue(),'10');
   await sell.getByPlaceholder('e.g. 25,000').fill('99.90');
   await sell.getByRole('button',{name:'Fill Torn shares'}).click();
   assert.equal(await sell.locator('.input-money').inputValue(),'10');
   assert.equal(await page.evaluate(()=>window.trades),0);
   await page.getByRole('button',{name:'Hide stock',exact:true}).click();
   await page.locator('#FHG').waitFor({state:'hidden'});
   await page.getByRole('button',{name:'Show hidden stocks (1)'}).click();
   await page.getByRole('button',{name:'Restore stock'}).click();
   await page.getByRole('button',{name:'Hide stock',exact:true}).waitFor();
   await page.close();
  }
 }finally{await browser.close();}
 console.log('Stocks browser fixture: desktop/mobile, buy/sell fill, limits, no submission and hide/restore passed');
})().catch(error=>{console.error(error);process.exitCode=1;});
