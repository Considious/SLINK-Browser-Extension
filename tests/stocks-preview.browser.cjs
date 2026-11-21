const assert=require('node:assert/strict');
const path=require('node:path');
const {chromium}=require(process.env.SLINK_PLAYWRIGHT_MODULE||'playwright');
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true});
 try{
  for(const width of [390,1100]){
   const page=await browser.newPage({viewport:{width,height:800}});
   await page.route('https://www.torn.com/**',route=>route.fulfill({contentType:'text/html',body:
    '<style>:root{--slt-text:#edf1f7;--slt-link:#c9e8ff;--slt-surface:#242831}#stockmarketroot{width:100%}.stock___a{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));padding:0;margin:0;list-style:none}.stock___a>li{min-width:0}</style><main id="stockmarketroot"><ul class="stock___a" id="FHG"><li class="stockName___a"><div class="nameContainer___a">Feathery Hotels</div></li><li class="stockPrice__a"><span class="price__a">$10.00</span></li><li class="stockOwned__a active__a"></li><li class="stockDividend___a"><div class="dividendInfo___a">Weekly payout</div></li></ul><div class="stockDropdown__a"><form class="buyBlock__a"><input class="input-money"><button>Buy</button></form><form class="sellBlock__a"><input class="input-money"><button>Sell</button></form></div></main>'}));
   await page.goto('https://www.torn.com/page.php?sid=stocks');
   await page.evaluate(()=>{
    window.trades=0;
    document.addEventListener('submit',e=>{e.preventDefault();window.trades++;});
    window.SLINK_EXTENSION={core:{storage:{get:async()=>[],set:async()=>{}},messaging:{send:async()=>({
     holdings:[{id:1,shares:100,transactions:[{shares:100,price:8}]}],market:[{id:1,acronym:'FHG',market:{price:10},bonus:{requirement:100}}],cash:500,fetchedAt:Date.now()
    })}}};
   });
   for(const f of ['core/torn-components.js','core/stocks-preview.js','content/stocks-preview.js'])await page.addScriptTag({path:path.join(__dirname,'../src',f)});
   await page.getByRole('button',{name:'Load / refresh stocks'}).click();
   await page.locator('.slink-stock-benefit').waitFor();
   assert.match(await page.locator('.slink-stock-benefit').getAttribute('title'),/200 more shares/);
   assert.equal(await page.locator('#FHG > li').count(),4);
   assert.equal(await page.locator('#FHG > :not(li)').count(),0);
   const hide=page.getByRole('button',{name:'Hide stock',exact:true});
   const computed=await hide.evaluate(el=>({color:getComputedStyle(el).color,width:el.getBoundingClientRect().width,height:el.getBoundingClientRect().height}));
   assert.notEqual(computed.color,'rgb(0, 0, 0)');
   assert.ok(computed.width<80&&computed.height<25);
   assert.equal(await hide.locator('..').getAttribute('class'),'nameContainer___a');
   const buy=page.locator('.buyBlock__a'),sell=page.locator('.sellBlock__a');
   const buyTools=page.locator('.slink-stock-amount').filter({has:page.getByLabel('Buy budget ($)')});
   const sellTools=page.locator('.slink-stock-amount').filter({has:page.getByLabel('Sell up to ($ net)')});
   assert.equal(await page.locator('#stockmarketroot .slink-stock-amount').count(),0);
   await buyTools.getByPlaceholder('e.g. 25,000').fill('100');
   await buyTools.getByRole('button',{name:'Fill Torn shares'}).click();
   assert.equal(await buy.locator('.input-money').inputValue(),'10');
   await buyTools.getByPlaceholder('e.g. 25,000').fill('600');
   await buyTools.getByRole('button',{name:'Fill Torn shares'}).click();
   assert.equal(await buy.locator('.input-money').inputValue(),'10');
   await sellTools.getByPlaceholder('e.g. 25,000').fill('99.90');
   await sellTools.getByRole('button',{name:'Fill Torn shares'}).click();
   assert.equal(await sell.locator('.input-money').inputValue(),'10');
   assert.equal(await page.evaluate(()=>window.trades),0);
   await buy.getByRole('button',{name:'Buy'}).click();
   await page.locator('#stockmarketroot').evaluate(root=>{root.outerHTML=root.outerHTML;});
   await buy.locator('.input-money').fill('');
   await buyTools.getByPlaceholder('e.g. 25,000').fill('110');
   await buyTools.getByRole('button',{name:'Fill Torn shares'}).click();
   assert.equal(await buy.locator('.input-money').inputValue(),'11');
   assert.equal(await page.evaluate(()=>window.trades),1);
   assert.equal(await page.locator('.slink-stocks-panel').count(),1);
   assert.equal(await page.locator('#stockmarketroot .slink-stock-amount').count(),0);
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
