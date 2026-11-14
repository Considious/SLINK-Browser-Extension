const assert=require('node:assert/strict');
const path=require('node:path');
const {chromium}=require(process.env.SLINK_PLAYWRIGHT_MODULE||'playwright');
const files={'casino-guide':'content/casino-guide','native-list-filter':'content/native-list-filter','travel-run':'modules/travel-run'};
const script=(page,name)=>page.addScriptTag({path:path.join(__dirname,'../src',(files[name]||'core/'+name)+'.js')});
(async()=>{
 const browser=await chromium.launch({channel:'chrome'});
 try{
  for(const width of [320,1024])for(const theme of ['default-light','default-dark','Candy','Halloween','Christmas']){
   const page=await browser.newPage({viewport:{width,height:800},hasTouch:width<500});
   await page.route('https://www.torn.com/**',r=>r.fulfill({body:'<meta name="viewport" content="width=device-width"><main id="mainContainer"><button id="native">Torn control</button><ul class="games-list"><li><a href="/page.php?sid=roulette">Roulette</a></li><li><a href="/page.php?sid=poker">Poker</a></li></ul></main>',contentType:'text/html'}));
   await page.goto('https://www.torn.com/casino.php');
   const native=()=>page.locator('#native').evaluate(el=>getComputedStyle(el).backgroundColor);
   const before=await native();
   await script(page,'torn-components');
   assert.equal(await native(),before);
   if(theme==='default-dark')await page.evaluate(()=>document.body.classList.add('dark-mode'));
   if(!theme.startsWith('default')){
    await script(page,theme.toLowerCase()+'-theme');await script(page,'torn-theme');
    await page.evaluate(name=>{
      const palette=window['SLINK_'+name.toUpperCase()+'_THEME'].definition;
      const style=document.createElement('style');
      style.textContent=SLINK_TORN_THEME.compile({theme:palette,settings:{enabled:true}}).css;
      document.documentElement.dataset.slinkTornTheme='on';document.head.append(style);
    },theme);
   }
   await script(page,'casino-guide');
   if(width<500)await page.getByText('Show or hide casino games').tap();else await page.getByText('Show or hide casino games').click();
   const roulette=page.getByRole('switch',{name:'Roulette'});
   await roulette.uncheck();
   assert.equal(await page.locator('.games-list a').first().isVisible(),false);
   await roulette.check();
   assert.equal(await page.locator('.games-list a').first().isVisible(),true);
   const styles=await page.locator('.slink-page-card').evaluate(card=>{
    function channels(color){
     const canvas=document.createElement('canvas');canvas.width=1;canvas.height=1;
     const ctx=canvas.getContext('2d');ctx.fillStyle=color;ctx.fillRect(0,0,1,1);
     return [...ctx.getImageData(0,0,1,1).data];
    }
    const cs=getComputedStyle(card),button=card.querySelector('button'), bs=getComputedStyle(button);
    const lum=color=>channels(color).slice(0,3).reduce((a,b,i)=>{b/=255;return a+[.2126,.7152,.0722][i]*(b<=.04045?b/12.92:((b+.055)/1.055)**2.4);},0);
    const contrast=(a,b)=>{const v=[lum(a),lum(b)].sort((x,y)=>y-x);return (v[0]+.05)/(v[1]+.05);};
    return {card:contrast(cs.color,cs.backgroundColor),action:contrast(bs.color,bs.backgroundColor),width:card.scrollWidth,client:card.clientWidth};
   });
   assert.ok(styles.card>=4.5&&styles.action>=4.5&&styles.width<=styles.client+1,JSON.stringify({theme,width,styles}));
   await page.evaluate(()=>{history.replaceState(null,'','/factions.php');const fixture=document.createElement('section');fixture.className='faction-info-wrap';fixture.innerHTML='<ul class="members-list"><li><a href="/profiles.php?XID=1234567">Example Player</a></li></ul>';document.querySelector('main').append(fixture);});
   await script(page,'native-list-filter');
   await page.getByRole('button',{name:'Filter members',exact:true}).click();
   const search=page.getByRole('searchbox',{name:/filter members/i});
   await search.fill('missing player');
   const card=page.locator('.slink-page-card').filter({hasText:'Faction member filters'});
   assert.ok(await card.evaluate(el=>el.scrollWidth<=el.clientWidth+1));
   await search.focus();assert.notEqual(await search.evaluate(el=>getComputedStyle(el).outlineStyle),'none');
   await page.evaluate(()=>{history.replaceState(null,'','/travelagency.php');const travel=document.createElement('div');travel.id='travel-root';document.querySelector('main').append(travel);});
   await script(page,'travel-run');
   await page.getByRole('button',{name:'Set up Travel Run'}).click();
   const plan=page.locator('#slink-travel-run').locator('.slink-page-card');
   assert.ok(await plan.evaluate(el=>el.scrollWidth<=el.clientWidth+1));
   await page.evaluate(()=>{window.SLINK_QOL={BLOOD:[],normalize:(v={})=>({favorites:[],links:[],...v})};});
   await script(page,'qol-ui');await script(page,'companion');
   await page.evaluate(async()=>{
     const host=document.createElement('div');document.querySelector('main').append(host);const shadow=host.attachShadow({mode:'open'});
     const area=document.createElement('section');area.id='settings-fixture';shadow.append(area);
     const prefs=document.createElement('section');prefs.id='companion-fixture';shadow.append(prefs);
     window.SLINK_QOL={BLOOD:[],normalize:(v={})=>({favorites:[],links:[],...v})};
     await SLINK_QOL_UI.create({load:async()=>({allowed:true,settings:{}}),save:async()=>{}}).mount(area);
     SLINK_COMPANIONS.create({allowed:()=>true,open:()=>{},asset:()=>'',settingsParent:prefs,setSettingsAvailable:()=>{},storage:{getItem:()=>'{"id":"off"}'}});
   });
   await page.locator('#settings-fixture').getByRole('switch',{name:'Enable page tools'}).waitFor();
   const positions=await page.locator('#companion-fixture select').evaluateAll(nodes=>nodes.map(n=>Math.round(n.getBoundingClientRect().x)));
   assert.equal(positions.length,3);assert.equal(new Set(positions).size,1);
   assert.equal(await page.locator('#companion-fixture').getByRole('switch',{name:'Idle chatter'}).count(),1);
   console.log(theme,width,'casino switches, theme contrast and responsive bounds');
   await page.close();
  }
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
