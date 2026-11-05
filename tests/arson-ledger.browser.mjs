import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
const {chromium}=createRequire(import.meta.url)(process.env.SLINK_PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({headless:true,executablePath:process.env.SLINK_BROWSER_EXECUTABLE});
try{
 const page=await browser.newPage({viewport:{width:390,height:600}});
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.setContent(`<main id="fixture" style="height:75px;overflow:hidden;margin-top:500px"><div class="virtual-item"><div class="crime-image">House</div><div class="titleAndScenario___fixture"><div>Beach Hut</div><span class="scenario___fixture">Naked Aggression</span></div><div class="fireMeter___fixture"></div><button class="itemButton___fixture" aria-expanded="false">Picker</button><button class="commit-button" aria-disabled="false"><span class="title___fixture">Place</span><span class="nerve___fixture">5</span></button></div></main>`);
 for(const f of ['arson-ledger','arson-advice','arson-page'])await page.addScriptTag({content:readFileSync(new URL('../src/core/'+f+'.js',import.meta.url),'utf8')});
 assert.equal(await page.evaluate(()=>SLINK_ARSON_LEDGER.scenarioCount),249);
 await page.evaluate(()=>{const record=(item,successes)=>({successes,steps:[{action:'place',item:'Gasoline'},{action:'ignite',item}]});window.stop=SLINK_ARSON_PAGE.mount({root:fixture,enabled:true,eligible:()=>true,focused:()=>true,journal:{candidates:async()=>[record('Flamethrower',3),record('Windproof Lighter',1)],record:async()=>{}}});});
 const icon=page.getByRole('button',{name:'Arson help'});
 await icon.hover();
 const portal=page.locator('[data-slink-arson-portal] [role=status]');
 await portal.waitFor({state:'visible'});
 const content=await portal.textContent();
 for(const value of ['Naked Aggression','Payout','Building stats','Open the material picker'])assert.ok(content.includes(value),value);
 assert.doesNotMatch(content,/Flamethrower|Ledger reference prices/);
 assert.equal(await page.locator('.fireMeter___fixture [data-slink-arson]').count(),1);
 assert.equal(await page.locator('.crime-image [data-slink-arson]').count(),0);
 await page.evaluate(()=>{
  const picker=document.createElement('div');picker.className='itemSelector___fixture';
  picker.innerHTML='<div class="group___fixture"><span class="heading___fixture">Liquids</span><div class="itemCellWrap___fixture"><button aria-label="Gasoline 8 owned" aria-disabled="false"></button></div></div><div class="group___fixture"><span class="heading___fixture">Igniters</span><div class="itemCellWrap___fixture"><button aria-label="Windproof Lighter Igniting is unavailable at this stage" aria-disabled="true"></button></div><div class="itemCellWrap___fixture"><button aria-label="Item locked" aria-disabled="true"></button></div></div>';
  document.body.append(picker);document.querySelector('.itemButton___fixture').setAttribute('aria-expanded','true');
 });
 await portal.getByText('Windproof Lighter',{exact:true}).waitFor();
 for(const value of ['Per nerve','Cost','Nerve','Place','Ignite'])assert.ok((await portal.textContent()).includes(value),value);
 assert.doesNotMatch(await portal.textContent(),/Flamethrower/);
  const plans=await page.evaluate(()=>{
    const steps=SLINK_ARSON_LEDGER.starterSteps('Beach Bum');
    const stock=new Map([['Gasoline',{ownedQty:8,locked:false,selectable:true}],['Windproof Lighter',{ownedQty:null,locked:false,disabledReason:'Igniting is unavailable at this stage'}]]);
    const job={phase:'preparation',action:'place',requirements:[]};
    return [SLINK_ARSON_ADVICE.observedFormula(job,stock,[],steps),SLINK_ARSON_ADVICE.observedFormula({...job,requirements:[{kind:'insurance'}]},stock,[],steps)];
  });
  assert.deepEqual(plans[0].record.steps.map(step=>step.item),['Gasoline','Gasoline','Windproof Lighter']);
  assert.equal(plans[0].provisional,true);
  assert.equal(plans[1].record,undefined);
 const box=await portal.boundingBox();assert.ok(box.x>=0&&box.y>=0&&box.x+box.width<=390&&box.y+box.height<=600);
 const row=await page.locator('#fixture').boundingBox();assert.ok(box.y<row.y,'Popup is not clipped to the job row');
 await icon.click();await portal.getByText('Building stats',{exact:true}).click();assert.ok(await portal.locator('details').evaluate(node=>node.open));
 await page.keyboard.press('Escape');await portal.waitFor({state:'detached'});
 await page.evaluate(()=>stop());assert.equal(await icon.count(),0);
 assert.deepEqual(errors,[]);
 console.log('Ledger source catalog, original formula layout, unclipped mobile-width popup, pinned details and cleanup passed.');
}finally{await browser.close();}
