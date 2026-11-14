const assert = require('node:assert/strict');
const path = require('node:path');
const { chromium } = require(process.env.SLINK_PLAYWRIGHT_MODULE || 'playwright');

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    for (const width of [320, 390]) {
      const page = await browser.newPage({ viewport: { width, height: 550 } });
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.route('http://fixture.invalid/', route => route.fulfill({contentType:'text/html',body:'<!doctype html><body></body>'}));
      await page.goto('http://fixture.invalid/');
      await page.evaluate(() => {
        const theme = () => SLINK_CANDY_THEME.definition;
        window.SLINK_EXTENSION = {
          core:{themes:{resolve:theme,cssVariables:()=>Object.entries(theme().tokens).map(([k,v])=>k+':'+v+';').join(''),applyHealthToElement(){}}},
          define(scope,key,value){this[scope][key]=value;}
        };
        window.SLINK_QOL={BLOOD:[],normalize:(v={})=>({favorites:[],links:[],...v})};
      });
      for(const file of ['core/candy-theme.js','content/ui-shell.js','core/companion.js','core/qol-ui.js']){
        await page.addScriptTag({path:path.join(__dirname,'..','src',file)});
      }
      await page.evaluate(async () => {
        window.ui=SLINK_EXTENSION.core.uiShell.createShell({themeId:SLINK_CANDY_THEME.definition.id,preferences:{}});
        ui.setTheme(SLINK_CANDY_THEME.definition.id);
        const view=await ui.createModuleView({id:'page-tools',title:'Page Tools',group:'quality-of-life'});
        await ui.ready;
        SLINK_QOL_UI.create({load:async()=>({settings:{}}),save:async()=>{}}).mount(view.getContentElement());
        window.eligible=false;
        window.companion=SLINK_COMPANIONS.create({
          allowed:()=>eligible,open:()=>{},asset:()=>'',settingsParent:ui.companionSettings,setSettingsAvailable:ui.setCompanionAvailable,
          storage:{getItem:()=>JSON.stringify({id:'off'}),setItem:()=>{}}
        });
      });
      const toggle=page.getByRole('button',{name:'Companion settings'});
      assert.equal(await toggle.count(),0);
      const rows=page.locator('.slink-qol-toggles label');
      await rows.last().waitFor();
      const boxes=await rows.evaluateAll(nodes=>nodes.map(e=>{
        const r=e.getBoundingClientRect(), p=e.parentElement.getBoundingClientRect();
        return {y:r.y,height:r.height,right:r.right,edge:p.right};
      }));
      assert.equal(boxes.length,5);
      assert.ok(boxes.every((box,i)=>box.right<=box.edge&&(!i||box.y>=boxes[i-1].y+boxes[i-1].height)));
      await page.evaluate(()=>{eligible=true;companion.sync();});
      await toggle.click();
      const panel=page.getByRole('region',{name:'Companion settings'});
      assert.equal(await toggle.getAttribute('aria-expanded'),'true');
      await panel.getByRole('combobox',{name:'Movement'}).selectOption('stay');
      await page.getByRole('button',{name:'Back to dashboard'}).click();
      await rows.last().waitFor();
      assert.equal(await toggle.getAttribute('aria-expanded'),'false');
      await toggle.click();
      await page.evaluate(()=>{eligible=false;companion.sync();});
      assert.equal(await toggle.count(),0);
      assert.equal(await panel.count(),0);
      assert.deepEqual(errors,[]);
      await page.close();
    }
    console.log('Candy Cartel dashboard: compact Page Tools rows and accessible Companion settings passed at 320px and 390px.');
  } finally { await browser.close(); }
})().catch(error=>{console.error(error);process.exitCode=1;});
