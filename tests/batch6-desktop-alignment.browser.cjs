const assert = require('node:assert/strict');
const path = require('node:path');
const { chromium } = require(process.env.SLINK_PLAYWRIGHT_MODULE || 'playwright');

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1300, height: 800 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route('https://www.torn.com/**', route => route.fulfill({
      contentType: 'text/html',
      body: '<style>#mainContainer{display:flex;width:1000px}#sidebar{width:200px}#native{flex:1}</style><div id="mainContainer"><aside id="sidebar">Sidebar</aside><main id="native"><div id="content">Loading</div></main></div>'
    }));
    const scripts = ['src/content/weapon-merits.js', 'src/content/weapon-details.js'];
    const load = async file => page.addScriptTag({ path: path.join(__dirname, '..', file) });
    const columns = () => page.locator('#mainContainer > *').evaluateAll(nodes => nodes.map(n => [n.id, n.getBoundingClientRect().width]));
    const stub = () => page.evaluate(() => {
      window.SLINK_EXTENSION = {core:{storage:{get:async()=>null}}};
      window.SLINK_WEAPON_MERITS = {};
    });
    await page.goto('https://www.torn.com/page.php?sid=ItemMarket');
    await stub();
    const baseline = await columns();
    for (const file of scripts) await load(file);
    assert.deepEqual(await columns(), baseline);
    assert.equal(await page.getByText('Show weapon merits').count(), 0);
    assert.equal(await page.getByText('Show weapon XP').count(), 0);

    await page.goto('https://www.torn.com/item.php');
    await stub();
    for (const file of scripts) await load(file);
    await page.evaluate(() => {
      window.fixtureFocus = true;
      document.hasFocus = () => window.fixtureFocus;
      window.SLINK_QOL = {BLOOD:[],normalize:v=>v||{enabled:true,quickItems:true,customLinks:false,effects:false,values:false,favorites:[],links:[]}};
    });
    await load('src/core/qol-ui.js');
    await page.evaluate(async () => {
      window.testTools = SLINK_QOL_UI.create({load:async()=>{if(window.failSettings)throw Error('fixture error');return {};},cached:async()=>{throw Error('cache unavailable');},updates:async()=>({}),save:async value=>{window.savedSettings=value;}});
      await testTools.sync();
      const manager=document.createElement('aside');manager.id='fixture-manager';document.body.append(manager);
      testTools.mount(manager,(message,tone)=>{manager.dataset.status=message;manager.dataset.tone=tone;});
    });
    const manager=page.locator('#fixture-manager');
    assert.equal(await manager.getAttribute('data-status'),'Saved settings loaded');
    assert.equal(await manager.locator('.slink-qol-toggles input').count(),5);
    await manager.getByText('Item effects').click();
    await page.waitForFunction(()=>window.savedSettings?.effects===true);
    assert.equal(await page.locator('[aria-label="SLINK quick use"]').count(), 0);
    await page.evaluate(() => {
      document.querySelector('#content').innerHTML = '<div class="equipped-items-wrap">Equipment</div>';
    });
    await page.locator('[aria-label="SLINK quick use"]').waitFor();
    await page.getByText('Show weapon merits').waitFor();
    await page.getByText('Show weapon XP').waitFor();
    assert.deepEqual(await columns(), baseline);
    assert.equal(await page.locator('#content > [aria-label="SLINK quick use"]').count(), 1);
    await page.evaluate(async () => {
      window.fixtureFocus = false;
      window.dispatchEvent(new Event('blur'));
      await testTools.sync();
    });
    await page.waitForTimeout(200);
    assert.equal(await page.locator('[aria-label="SLINK quick use"]').count(), 1);
    assert.deepEqual(await columns(), baseline);
    await page.evaluate(async()=>{window.failSettings=true;await testTools.sync();});
    assert.equal(await manager.getAttribute('data-tone'),'error');
    assert.match(await manager.getAttribute('data-status'),/fixture error/);
    assert.deepEqual(errors, []);
    console.log('Desktop fixture passed: no Item Market weapon controls, delayed Items mount, unchanged columns, persistent tray on blur.');
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
