import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
const {chromium}=createRequire(import.meta.url)(process.env.SLINK_PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({headless:true,executablePath:process.env.SLINK_BROWSER_EXECUTABLE});
try{
 const page=await browser.newPage({viewport:{width:390,height:600}});
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.setContent(`<main id="fixture" style="height:38px;overflow:hidden;margin-top:500px"><div class="virtual-item"><div class="titleAndScenario___fixture"><div>Beach Hut</div><span class="scenario___fixture">Beach Bum</span></div><div class="fireMeter___fixture"></div><button class="commit-button" aria-disabled="false"><span class="title___fixture">Breach</span><span class="nerve___fixture">3</span></button></div></main>`);
 for(const f of ['arson-ledger','arson-page'])await page.addScriptTag({content:readFileSync(new URL('../src/core/'+f+'.js',import.meta.url),'utf8')});
 assert.equal(await page.evaluate(()=>SLINK_ARSON_LEDGER.scenarioCount),249);
 await page.evaluate(()=>{window.stop=SLINK_ARSON_PAGE.mount({root:fixture,enabled:true,eligible:()=>true,focused:()=>true});});
 const icon=page.getByRole('button',{name:'Arson help'});
 await icon.hover();
 const portal=page.locator('[data-slink-arson-portal] [role=status]');
 await portal.waitFor({state:'visible'});
 const content=await portal.textContent();
 for(const value of ['Beach Bum','Per nerve','Payout','Cost','Nerve','Place','Ignite','Building stats'])assert.ok(content.includes(value),value);
 const box=await portal.boundingBox();assert.ok(box.x>=0&&box.y>=0&&box.x+box.width<=390&&box.y+box.height<=600);
 const row=await page.locator('#fixture').boundingBox();assert.ok(box.y<row.y,'Popup is not clipped to the job row');
 await icon.click();await portal.getByText('Building stats',{exact:true}).click();assert.ok(await portal.locator('details').evaluate(node=>node.open));
 await page.keyboard.press('Escape');await portal.waitFor({state:'detached'});
 await page.evaluate(()=>stop());assert.equal(await icon.count(),0);
 assert.deepEqual(errors,[]);
 console.log('Ledger source catalog, original formula layout, unclipped mobile-width popup, pinned details and cleanup passed.');
}finally{await browser.close();}
