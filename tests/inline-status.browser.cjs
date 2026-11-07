const assert=require('node:assert/strict');
const path=require('node:path');
const {chromium}=require(process.env.SLINK_PLAYWRIGHT_MODULE||'playwright');
(async()=>{
 const browser=await chromium.launch({channel:'msedge'});
 try{for(const pda of [false,true]){
  const page=await browser.newPage({viewport:{width:pda?390:1100,height:800}});
  await page.route('https://www.torn.com/**',r=>r.fulfill({contentType:'text/html',body:'<aside id="sidebar"></aside><main id="mainContainer"></main>'}));
  await page.goto('https://www.torn.com/joblist.php');
  await page.evaluate(pda=>{
   const now=Date.now(), session={token:'fixture',userId:1,expiresAt:now+600000,scopes:['slink.adhd.alerts','slink.qol.company']};
   const company={userId:1,fetchedAt:now,company:{id:3,name:'Company One'},self:{id:1,name:'Me',addictionPenalty:0,totalEffectiveness:110},employees:[{id:2,name:'Employee Two'}],director:false};
   const alerts={fetchedAt:now,data:{profile:{id:1},cooldowns:{medical:150}}};
   window.virusRequests=0;
   const virus=async()=>{window.virusRequests++;return {virus:{time_left:180}};};
   if(pda)window.SLINK_PDA_PLUGIN_API={inlineStatus:()=>({owner:1,expiresAt:session.expiresAt,canVirus:true,canCompany:true,company,alerts}),tornJson:virus};
   else{
    const cache={'access.session.v1':session,'company.runtime.v1':{snapshot:company},'adhd.runtime.v1':{snapshot:alerts}};
    window.SLINK_EXTENSION={core:{storage:{get:async k=>cache[k],fullKey:k=>k},permissions:{hasScope:(s,k)=>s.scopes.includes(k)},messaging:{send:virus}}};
   }
   window.promote=()=>{company.director=true;document.dispatchEvent(new Event('visibilitychange'));};
  },pda);
  await page.addScriptTag({path:path.join(__dirname,'../src/content/inline-status.js')});
  await page.getByText('SLINK · Your company',{exact:true}).click();
  await page.getByText(/addiction penalty 0 · effectiveness 110/).waitFor();
  assert.equal(await page.getByText(/Employee Two/).count(),0);
  await page.evaluate(()=>promote());await page.getByText(/Employee Two/).waitFor();
  await page.getByText('SLINK timers',{exact:true}).click();
  await page.getByText(/Medical cooldown:/).waitFor();
  assert.equal(await page.evaluate(()=>virusRequests),0);
  await page.getByRole('button',{name:'Check virus timer'}).click();
  await page.getByText(/Virus coding ends:/).waitFor();
  assert.equal(await page.evaluate(()=>virusRequests),1);
  await page.close();
 }}finally{await browser.close();}
 console.log('Inline status: desktop/PDA layouts, director access and on-demand virus check passed');
})().catch(e=>{console.error(e);process.exitCode=1;});
