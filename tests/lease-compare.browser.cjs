const assert=require('node:assert/strict'),path=require('node:path');
const {chromium}=require(process.env.SLINK_PLAYWRIGHT_MODULE||'playwright');
const script='../src/content/lease-compare.js';
require(script);
const rows=[{cost:1000,rental_period:10,happy:100},{cost:3000,rental_period:10,happy:200},{cost:6000,rental_period:20,happy:200},{cost:9999,rental_period:0}];
assert.deepEqual(globalThis.SLINK_LEASE_COMPARE.compare(rows,{days:10,happy:150}),{daily:{n:2,low:300,median:300,high:300},term:{n:1,low:3000,median:3000,high:3000}});
(async()=>{
 const browser=await chromium.launch({channel:'msedge'});
 try{for(const pda of [false,true]){
   const page=await browser.newPage({viewport:{width:pda?390:1100,height:800}});
   await page.route('https://www.torn.com/**',r=>r.fulfill({contentType:'text/html; charset=utf-8',body:'<main id="properties-page-wrap"><div class="properties-tabs">Properties</div><form><input name="days" value="7"><button>Lease</button></form></main>'}));
   await page.addInitScript(({rows,pda})=>{
     window.calls=[];
     const request=async type=>{window.calls.push(type);return type?{rentals:{listings:rows}}:{properties:[{id:1,name:'Villa'},{id:2,name:'Penthouse'}]};};
     if(pda)window.SLINK_PDA_PLUGIN_API={ensurePermission:async()=>({userId:4}),accountId:()=>4,hasScope:()=>true,tornJson:async path=>request(Number(path.match(/market\/(\d+)/)?.[1]||0))};
     else window.SLINK_EXTENSION={core:{messaging:{send:async(_,args)=>request(args.type)}}};
   },{rows,pda});
   await page.goto('https://www.torn.com/properties.php');await page.addScriptTag({path:path.join(__dirname,script)});
   await page.getByText('SLINK rental comparison').click();assert.deepEqual(await page.evaluate(()=>window.calls),[]);
   await page.getByRole('button',{name:'Load property types'}).click();
   await page.getByLabel('Property',{exact:true}).selectOption({label:'Villa'});
   await page.getByLabel('Lease days (optional)',{exact:true}).fill('10');
   await page.getByRole('button',{name:'Compare rental listings'}).click();
   await page.getByText('10 days, upfront rent: $2,000 median',{exact:false}).waitFor();
   await page.getByLabel('Minimum happiness (optional)',{exact:true}).fill('150');
   await page.getByText('10 days, upfront rent: $3,000 median',{exact:false}).waitFor();
   assert.equal(await page.locator('form input').inputValue(),'7');
   await page.getByLabel('Property',{exact:true}).selectOption({label:'Penthouse'});
   await page.getByText('Rent per day:',{exact:false}).waitFor({state:'detached'});
   assert.deepEqual(await page.evaluate(()=>window.calls),[0,1]);
   await page.close();
 }}finally{await browser.close();}
 console.log('Lease comparison: correct sample statistics, filters, and no native form changes passed');
})().catch(e=>{console.error(e);process.exitCode=1;});
