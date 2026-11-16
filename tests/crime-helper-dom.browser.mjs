import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';

const require=createRequire(import.meta.url);
const {chromium}=require(process.env.SLINK_PLAYWRIGHT_MODULE||'playwright');
const pda=process.env.SLINK_CRIME_FIXTURE_PDA;
const lifecycle=pda?resolve(pda,'00-crime-lifecycle.part'):resolve('src/core/crime-lifecycle.js');
const helper=name=>pda?resolve(pda,'00-'+name+'-helper.part'):resolve('src/content/'+name+'-helper.js');
const fixtures={
 disposal:'<main id="mainContainer"><div class="currentCrime___sample"><div class="crimeOptionWrapper___sample"><div class="crime-option"><div class="crime-option-sections"><div class="crime-image"></div><div class="crimeOptionSection___FL3HG flexGrow___AYYE7" data-job>General Waste</div><div><button aria-label="Bury">Bury</button><button aria-label="Burn">Burn</button></div><button aria-disabled="true">Dispose</button></div></div></div></div></main>',
 forgery:'<main id="mainContainer"><div class="crime-option">Project picker host</div></main><div id="portal"></div>',
 hustling:'<main id="mainContainer"><div class="crimes-app-header">Crimes</div><div class="audienceSection___test"></div><div class="crimeOptionWrapper___Av99B"><div class="crime-option"><div class="crime-option-sections"><div class="crimeOptionSection___FL3HG flexGrow___AYYE7 title___u75NN" data-game>Cornhole</div><div class="techniqueBar___txVdW" aria-label="Technique: 0 out of 7"></div><span class="betAmount___ApWcz">$0</span><div id="controls"><button aria-disabled="true" aria-label="There&#39;s no audience"><span class="title___nOk1n">Demo</span></button></div></div></div></div></main>'
};
const picker='<div class="dropdownList" data-testid="dropdown-list"><ul role="listbox">'+[
 ['Parking Permit',false],['Concert Ticket',false],['Collection Bucket',false],['Passport',true]
].map(([name,locked])=>'<li role="option" data-testid="option-'+name.replaceAll(' ','-')+'" aria-disabled="'+locked+'" tabindex="0"><div class="optionWithLevelRequirement___CojuV"><div class="level___MUCxF">Level</div><span class="name___oViBs">'+name+'</span></div></li>').join('')+'</ul></div>';

const browser=await chromium.launch({headless:true,executablePath:process.env.SLINK_BROWSER_EXECUTABLE});
try{
 const page=await browser.newPage({viewport:{width:360,height:740}});
 const errors=[];
 page.on('pageerror',error=>errors.push(error.message));

 async function start(crime){
  await page.unrouteAll();
  await page.route('**/*',route=>route.request().isNavigationRequest()
   ?route.fulfill({contentType:'text/html',body:fixtures[crime]})
   :route.abort());
  await page.goto('https://www.torn.com/page.php?sid=crimes&fixture='+crime+'#/'+crime);
  await page.addScriptTag({path:lifecycle});
  await page.addScriptTag({path:helper(crime)});
  await page.evaluate(name=>{
   window.guide=window['SLINK_'+name.toUpperCase()].connect({eligible:()=>true});
   window.guide.setEnabled(true);
  },crime);
 }
 async function waitFor(selector,text){
  try{
   await page.waitForFunction(([selector,text])=>document.querySelector(selector)?.textContent.includes(text),[selector,text],{timeout:4000});
  }catch(error){
   throw new Error(selector+' did not display '+text,{cause:error});
  }
 }

 await start('disposal');
 await waitFor('[data-job] > [data-slink-disposal-advice]','Bury');
 assert.equal(await page.getByRole('button',{name:'Bury'}).count(),1);
 await page.locator('[data-job]').evaluate(title=>{title.firstChild.nodeValue='Old Furniture';});
 await waitFor('[data-job] > [data-slink-disposal-advice]','Burn');
 await page.locator('[data-job]').evaluate(title=>{title.firstChild.nodeValue='Unrecognized project';});
 await page.locator('[data-slink-disposal-advice]').waitFor({state:'detached'});
 await page.locator('[data-job]').evaluate(title=>{title.firstChild.nodeValue='Broken Appliance';});
 await waitFor('[data-job] > [data-slink-disposal-advice]','Sink');
 await page.evaluate(()=>window.guide.setEnabled(false));
 await page.locator('[data-slink-disposal-advice]').waitFor({state:'detached'});

 await start('forgery');
 await page.locator('#portal').evaluate((portal,html)=>{portal.innerHTML=html;},picker);
 await page.locator('[data-slink-forgery-risk="Lower risk"]').waitFor();
 assert.equal(await page.getByText('Concert Ticket').getAttribute('data-slink-forgery-risk'),'Moderate');
 assert.equal(await page.getByText('Collection Bucket').getAttribute('data-slink-forgery-risk'),'Unrated');
 assert.equal(await page.getByText('Passport').getAttribute('data-slink-forgery-risk'),'High risk');
 assert.equal(await page.getByRole('option',{name:/Passport/}).getAttribute('aria-disabled'),'true');
 await page.evaluate(()=>{location.hash='/disposal';});
 await page.locator('[data-slink-forgery-risk]').first().waitFor({state:'detached'});
 await page.evaluate(()=>{location.hash='/forgery';});
 await page.locator('[data-slink-forgery-risk="Lower risk"]').waitFor();
 await page.evaluate(()=>window.guide.setEnabled(false));
 await page.locator('[data-slink-forgery-risk]').first().waitFor({state:'detached'});

 await start('hustling');
 await waitFor('[data-game] > [data-slink-hustling]','Wait for a crowd');
 assert.equal(await page.locator('.crimes-app-header + [data-slink-hustling]').count(),0);
 await page.evaluate(()=>{
  document.querySelector('[class*="audienceSection___"]').innerHTML='<div class="audienceMember___test" aria-label="Attention: 42%, Suspicion: 9%"></div>';
  document.querySelector('#controls').innerHTML='<button>Hype</button>';
 });
 await waitFor('[data-game] > [data-slink-hustling]','Use Hype');
 await page.evaluate(()=>{
  document.querySelector('[class*="betAmount___"]').textContent='$1,200';
  document.querySelector('#controls').innerHTML='<button>Win</button><button>Lose</button>';
 });
 await waitFor('[data-game] > [data-slink-hustling]','$1,200');
 const guidance=await page.locator('[data-slink-hustling]').textContent();
 assert.match(guidance,/Peak attention 42%/);
 assert.match(guidance,/Peak suspicion 9%/);
 assert.equal(await page.getByRole('button',{name:'Win'}).count(),1);
 await page.evaluate(()=>window.guide.setEnabled(false));
 await page.locator('[data-slink-hustling]').waitFor({state:'detached'});
 assert.deepEqual(errors,[]);
 console.log('Disposal job titles, portaled Forgery options, and inline Hustling advice passed'+(pda?' on PDA fragments.':' on Extension.'));
}finally{
 await browser.close();
}
