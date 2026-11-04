import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.SLINK_PLAYWRIGHT_MODULE || 'playwright');
const captures=process.argv.slice(2);
assert([9,14].includes(captures.length),'Supply the nine base captures, optionally followed by the five requirement captures.');
const browser=await chromium.launch({headless:true,executablePath:process.env.SLINK_BROWSER_EXECUTABLE});
try{
  const page=await browser.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.route('**/*',route=>route.abort());
  await page.setContent('<main id="fixture"></main>');
  await page.evaluate(()=>{window.SLINK_EXTENSION={core:{},define(group,key,value){this[group][key]=value;}};});
  await page.addScriptTag({path:fileURLToPath(new URL('../src/core/arson-page.js',import.meta.url))});
  const expected=[['inquired','breach',0,3,true,null],['preparation','place',0,5,false,null],['preparation','ignite',0,5,true,'Windproof Lighter'],['burning','stoke',8,5,false,'Windproof Lighter']];
  for(const [i,path] of captures.slice(0,4).entries()){
    const actual=await page.evaluate(html=>{
      const parsed=new DOMParser().parseFromString(html,'text/html');
      const row=parsed.querySelector('.virtual-item');
      return SLINK_EXTENSION.core.arsonPage.readJob(row);
    },fs.readFileSync(path,'utf8'));
    assert.equal(actual.name,'Beach Hut');assert.equal(actual.scenario,'Beach Bum');
    assert.deepEqual([actual.phase,actual.action,actual.damage,actual.nerveCost,actual.usable,actual.selected],expected[i]);
    assert.equal(actual.ownedQty,null);assert.equal(actual.bounds,null);
  }
  const limits=[{kind:'total',min:100,max:100},{kind:'maximum',max:25},{kind:'minimum',min:65},{kind:'range',min:50,max:70}];
  for(const [i,path] of captures.slice(4,8).entries()){
    const result=await page.evaluate(html=>{
      const row=new DOMParser().parseFromString(html,'text/html').querySelector('.virtual-item');
      const {readJob,guidance,damagePosition}=SLINK_EXTENSION.core.arsonPage;
      const job=readJob(row);const {label,...bounds}=job.bounds;
      return {bounds,label,guidance:guidance(job),positions:[0,24.9,25,50,65,65.1,70,70.1,99.9,100].map(n=>damagePosition(n,job.bounds))};
    },fs.readFileSync(path,'utf8'));
    assert.deepEqual(result.bounds,limits[i]);assert(result.guidance.includes(result.label));
    if(i===0)assert.deepEqual(result.positions.slice(-2),['below','within']);
    if(i===1)assert.deepEqual(result.positions.slice(1,3),['within','above']);
    if(i===2){assert.deepEqual(result.positions.slice(4,6),['below','within']);assert.equal(result.positions.at(-1),'within');}
    if(i===3)assert.deepEqual(result.positions.slice(3,8),['boundary','within','within','boundary','above']);
  }
  const picker=await page.evaluate(html=>SLINK_EXTENSION.core.arsonPage.readPicker(new DOMParser().parseFromString(html,'text/html')),fs.readFileSync(captures[8],'utf8'));
  assert.equal(picker.length,15);
  assert.deepEqual(picker.filter(item=>item.selectable).map(({name,ownedQty})=>[name,ownedQty]),[
    ['Gasoline',858],['Diesel',90],['Potassium Nitrate',39],['Magnesium Shavings',32],['Oxygen Tank',42]]);
  assert(picker.some(item=>item.name==='Blanket'&&!item.selectable&&item.ownedQty===null));
  assert(picker.some(item=>item.name==='Windproof Lighter'&&!item.selectable&&item.ownedQty===null));
  assert(picker.filter(item=>item.locked).every(item=>item.name===null&&item.ownedQty===null&&item.selectable===false));
  if(captures.length===14){
    const expectedRequests=[
      [['Business'],['accidental']],
      [['Fraud'],['accidental','insurance']],
      [['Ideological'],['family:liquid']],
      [['Ideological'],['visibility:high']],
      [['Ideological'],['family:gas']]
    ];
    for(const [index,path] of captures.slice(9).entries()){
      const result=await page.evaluate(html=>{
        const doc=new DOMParser().parseFromString(html,'text/html');
        const {context,requirements}=SLINK_EXTENSION.core.arsonPage.readRequests(doc);
        return [context,requirements.map(r=>[r.kind,r.family||r.level].filter(Boolean).join(':'))];
      },fs.readFileSync(path,'utf8'));
      assert.deepEqual(result,expectedRequests[index]);
    }
  }
  const variants=await page.evaluate(()=>{
    const doc=new DOMParser().parseFromString('<div class="requestIcons___fixture"><div role="img" aria-label="Accelerant requested: Gaseous"></div><div role="img" aria-label="Accelerant requested: Solids"></div><div role="img" aria-label="Low-visibility fire requested"></div><div role="img" aria-label="Unexpected requirement"></div></div>','text/html');
    return SLINK_EXTENSION.core.arsonPage.readRequests(doc).requirements.map(r=>r.family||r.level||r.kind);
  });
  assert.deepEqual(variants,['gas','solid','low','unknown']);
  await page.evaluate(html=>{
    const parsed=new DOMParser().parseFromString(html,'text/html');
    const row=parsed.querySelector('.virtual-item');
    row.querySelectorAll('img,script,iframe,link').forEach(node=>node.remove());
    fixture.append(document.importNode(row,true));window.gameClicks=0;
    fixture.querySelector('.commit-button').onclick=()=>gameClicks++;
    const mount=SLINK_EXTENSION.core.arsonPage.mount;
    mount({root:fixture,enabled:false,eligible:()=>true});
    if(fixture.querySelector('[data-slink-arson]'))throw Error('Disabled helper mounted');
    window.dispose=mount({root:fixture,enabled:true,eligible:()=>true});
  },fs.readFileSync(captures[3],'utf8'));
  const button=page.getByRole('button',{name:'Arson help'});
  await button.focus();assert.equal(await button.getAttribute('aria-expanded'),'true');
  assert.match(await page.locator('[data-slink-arson] [role=status]').textContent(),/enough nerve/i);
  await button.press('Escape');assert.equal(await button.getAttribute('aria-expanded'),'false');
  await button.dispatchEvent('pointerdown',{pointerType:'touch',clientX:10,clientY:10});
  await page.waitForFunction(()=>document.querySelector('[data-slink-arson] button').getAttribute('aria-expanded')==='true');
  await button.dispatchEvent('pointerup',{pointerType:'touch'});
  await button.press('Escape');
  await button.click();assert.equal(await button.getAttribute('aria-expanded'),'true');
  await page.evaluate(()=>fixture.querySelector('[role=meter][aria-label=Damage]').setAttribute('aria-valuenow','12'));
  await page.waitForFunction(()=>document.querySelector('[data-slink-arson] [role=status]').textContent.includes('12% damage'));
  assert.match(await page.locator('[data-slink-arson] [role=status]').textContent(),/rose from 8% to 12%/);
  const guidance=await page.evaluate(()=>{
    const {guidance,parseDamageRequirement}=SLINK_EXTENSION.core.arsonPage;
    const job={phase:'burning',damage:23,usable:true,bounds:parseDamageRequirement('Less than 25% damage required')};
    return [guidance(job,20),guidance({...job,bounds:parseDamageRequirement('More than 65% damage required')},20)];
  });
  assert.match(guidance[0],/Hold off on stoking/);
  assert.match(guidance[0],/2 percentage points/);
  assert.doesNotMatch(guidance[1],/dampen/i);
  assert.equal(await page.evaluate(()=>gameClicks),0);
  await page.evaluate(()=>dispatchEvent(new Event('blur')));
  assert.equal(await button.count(),0);
  await page.evaluate(()=>{dispatchEvent(new Event('focus'));dispose();});
  assert.equal(await button.count(),0);assert.deepEqual(errors,[]);
  await page.route('https://www.torn.com/page.php*',route=>route.fulfill({contentType:'text/html',body:'<main id="fixture"></main>'}));
  await page.goto('https://www.torn.com/page.php?sid=crimes#/arson');
  await page.addScriptTag({path:fileURLToPath(new URL('../src/core/arson-page.js',import.meta.url))});
  await page.evaluate(html=>{
    const row=new DOMParser().parseFromString(html,'text/html').querySelector('.virtual-item');
    row.querySelectorAll('img,script,iframe,link').forEach(node=>node.remove());
    fixture.append(document.importNode(row,true));
    window.connection=SLINK_ARSON_PAGE.connect({eligible:()=>true});
  },fs.readFileSync(captures[3],'utf8'));
  assert.equal(await button.count(),0);
  await page.evaluate(()=>connection.setEnabled(true));await button.waitFor();
  await page.evaluate(()=>location.hash='/pickpocketing');await button.waitFor({state:'detached'});
  await page.evaluate(()=>location.hash='/arson');await button.waitFor();
  await page.evaluate(()=>connection.setEnabled(false));await button.waitFor({state:'detached'});
  await page.evaluate(()=>connection.dispose());assert.deepEqual(errors,[]);
  console.log(captures.length+' Arson captures parsed. Damage boundaries, picker inventory, requirements, help interactions, live updates and cleanup passed.');
}finally{await browser.close();}
