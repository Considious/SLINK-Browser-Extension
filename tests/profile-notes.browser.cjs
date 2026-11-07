const assert=require('node:assert/strict'),path=require('node:path');
const {chromium}=require(process.env.SLINK_PLAYWRIGHT_MODULE||'playwright');
(async()=>{
 const browser=await chromium.launch({channel:'msedge'});
 try{for(const pda of [false,true]){
  const page=await browser.newPage({viewport:{width:pda?390:1100,height:800}});
  await page.route('https://www.torn.com/**',r=>r.fulfill({contentType:'text/html',body:'<main id="mainContainer"></main>'}));
  await page.addInitScript(pda=>{
    window.account=1;
    if(pda){
      const prefs=JSON.parse(localStorage.getItem('fixture-pda')||'{}');
      window.SLINK_PDA_PLUGIN_API={accountId:()=>window.account,settings:()=>prefs,save:async()=>localStorage.setItem('fixture-pda',JSON.stringify(prefs))};
    }else window.SLINK_EXTENSION={core:{storage:{
      get:async(key,fallback)=>key==='access.session.v1'?{token:'fixture',expiresAt:Date.now()+600000,userId:window.account}:localStorage.getItem(key)??fallback,
      set:async(key,value)=>localStorage.setItem(key,value)
    }}};
  },pda);
  const open=async(id,reload=false)=>{
    if(reload)await page.reload();else await page.goto('https://www.torn.com/profiles.php?XID='+id);
    await page.addScriptTag({path:path.join(__dirname,'../src/content/profile-notes.js')});
    await page.getByText('SLINK · Private profile note',{exact:true}).click();
    await page.waitForFunction(()=>!document.querySelector('textarea')?.disabled);
    return page.getByRole('textbox');
  };
  const store=async(field,text)=>{await field.fill(text);await page.getByRole('button',{name:'Save note'}).click();await page.getByText(text?'Note saved.':'Note cleared.',{exact:true}).waitFor();};
  await store(await open(44),'<b>first profile</b>');
  assert.equal(await (await open(44,true)).inputValue(),'<b>first profile</b>');
  let field=await open(55);assert.equal(await field.inputValue(),'');await store(field,'second profile');
  field=await open(44);assert.equal(await field.inputValue(),'<b>first profile</b>');
  await page.evaluate(()=>window.account=2);await field.fill('wrong account');await page.getByRole('button',{name:'Save note'}).click();
  await page.getByText(/signed-in account changed/).waitFor();
  field=await open(44);assert.equal(await field.inputValue(),'<b>first profile</b>');
  await store(field,'');assert.equal(await (await open(44,true)).inputValue(),'');
  await page.close();
 }}finally{await browser.close();}
 console.log('Profile notes: desktop/PDA persistence, separate profiles, account-switch protection and clearing passed');
})().catch(e=>{console.error(e);process.exitCode=1;});
