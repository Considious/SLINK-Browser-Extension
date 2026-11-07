const assert=require('node:assert/strict'),path=require('node:path');
const {chromium}=require(process.env.SLINK_PLAYWRIGHT_MODULE||'playwright');
const script='../src/content/gym-guide.js';
require(script);
const {assess,exact}=globalThis.SLINK_GYM_GUIDE;
assert.equal(exact('1,250'),1250);assert.equal(exact('1.2m'),null);
const values={strength:125,speed:100,defense:90,dexterity:75};
assert.equal(assess(values,{"George's":true}).find(x=>x.name==='Gym 3000').met,true);
assert.equal(assess(values,{}).find(x=>x.name==='Total Rebound').gap,56.25);
assert.equal(assess({...values,strength:null},{}).find(x=>x.name==='Gym 3000').met,null);
const html='<main id="gymroot"><div class="notification__x"><span class="notificationText__x">Training</span></div><button class="gymButton_x active_x" title="George’s">George’s</button><button class="gymButton_x inProgress_x"><span class="gymName_x">Next Place</span><span class="percentage_x">32.5%</span></button>'+Object.entries(values).map(([k,v])=>'<div class="'+k+'___x"><span class="propertyTitle___x"><span class="propertyValue___x">'+v+'</span></span></div>').join('')+'</main>';
(async()=>{
 const browser=await chromium.launch({channel:'msedge'});
 try{for(const width of [390,1100]){
   const page=await browser.newPage({viewport:{width,height:800}});
   let requests=0;
   await page.route('https://www.torn.com/**',r=>{requests++;return r.fulfill({contentType:'text/html; charset=utf-8',body:html});});
   await page.goto('https://www.torn.com/gym.php');
   await page.addScriptTag({path:path.join(__dirname,script)});
   await page.getByText('SLINK Gym progress',{exact:true}).click();
   await page.getByText('Next Place — 32.5% toward unlock.').waitFor();
   await page.getByText("Gym 3000: Meets listed requirements · stat balance met · George's unlocked").waitFor();
   await page.locator('.percentage_x').evaluate(n=>n.textContent='40%');
   await page.getByText('Next Place — 40% toward unlock.').waitFor();
   await page.locator('.strength___x .propertyValue___x').evaluate(n=>n.textContent='100');
   await page.getByText('Gym 3000: needs about 25 more strength at current other stats',{exact:false}).waitFor();
   await page.locator('[title="George’s"]').evaluate(n=>n.classList.remove('active_x'));
   await page.getByText("Gym 3000: needs about 25 more strength at current other stats · George's unlock not verified").waitFor();
   assert.equal(requests,1);
   await page.close();
 }}finally{await browser.close();}
 console.log('Gym guide: progress updates, exact thresholds, unknown prerequisites, and zero added requests passed');
})().catch(e=>{console.error(e);process.exitCode=1;});
