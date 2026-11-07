const assert=require('node:assert/strict');
const path=require('node:path');
const {chromium}=require(process.env.SLINK_PLAYWRIGHT_MODULE||'playwright');
(async()=>{
 const browser=await chromium.launch({channel:'msedge'});
 try{for(const width of [390,1100]){
  const page=await browser.newPage({viewport:{width,height:800}});
  await page.route('https://www.torn.com/**',r=>r.fulfill({contentType:'text/html',body:
   '<form class="rehab-progress-wrap"><p class="rehab-desc">Rehab</p><div id="rehub-progress"><div class="ui-slider" data-percentages=\'{"1":60,"2":30,"3":0}\'></div><input id="native" type="range" value="50"></div><span class="money" data-cost="225000" data-money="450000"></span><button>Rehab</button></form>'}));
  await page.goto('https://www.torn.com/index.php?page=rehab');
  await page.evaluate(()=>{window.submits=0;document.addEventListener('submit',e=>{e.preventDefault();window.submits++;});});
  await page.addScriptTag({path:path.join(__dirname,'../src/content/rehab-preview.js')});
  const guide=page.getByRole('region',{name:'SLINK Rehab guide'});
  await guide.getByText(/675,000.*Above the cash/).waitFor();
  await guide.getByRole('textbox').fill('30');
  await guide.getByText(/450,000.*Fewer sessions/).waitFor();
  await guide.getByRole('textbox').press('Enter');
  assert.equal(await page.locator('#native').inputValue(),'50');assert.equal(await page.evaluate(()=>submits),0);
  await page.locator('.ui-slider').evaluate(el=>el.setAttribute('data-percentages','{"1":15}'));
  await guide.getByText(/1 session.*225,000/).waitFor();
  await page.locator('.ui-slider').evaluate(el=>el.removeAttribute('data-percentages'));
  await guide.getByText(/aren’t available to read/).waitFor();
  await page.close();
 }}finally{await browser.close();}
 console.log('Rehab guide: desktop/mobile, live option changes, unchanged slider and no submission passed');
})().catch(e=>{console.error(e);process.exitCode=1;});
