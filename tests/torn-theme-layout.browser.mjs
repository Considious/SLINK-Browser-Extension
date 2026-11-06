import assert from 'node:assert/strict';
import {readFile,mkdir} from 'node:fs/promises';
import {fileURLToPath,pathToFileURL} from 'node:url';
import path from 'node:path';
const root=fileURLToPath(new URL('../',import.meta.url));
const {chromium}=await import(pathToFileURL(process.env.SLINK_BROWSER_PACKAGE).href);
const browser=await chromium.launch({headless:true,executablePath:process.env.SLINK_BROWSER_EXECUTABLE});
const output=process.env.SLINK_QA_OUTPUT||path.join(root,'qa-output/torn-theme');await mkdir(output,{recursive:true});
const sourceRoot=process.env.SLINK_THEME_SOURCE_ROOT||path.join(root,'src/core');
const sources=process.env.SLINK_THEME_PDA==='1'?['00-torn-theme-variables.part','00-torn-theme-pages.part','00-torn-theme.part']:['torn-theme-variables.js','torn-theme-pages.js','torn-theme.js'];
const fixture=`<!doctype html><style>
body{margin:12px;font:12px Arial;background:#303030;color:#eee}.content-wrapper{width:min(400px,calc(100vw - 24px))}
.content-title,.appHeader___test,.appHeaderWrapper___test,#sidebar>.header___test{background:linear-gradient(#888,#444);height:30px;display:flex;align-items:center;justify-content:space-between}
.cont-gray{padding:0;border:0;margin:8px 0;width:100%;box-sizing:border-box;display:flow-root;background:#444}
.avatar{float:left;width:210px;height:280px;background:#111}.stats{float:right;width:140px;height:280px}.stats>div{height:90px;text-align:center}
.dropdown{background:var(--appheader-dropdown-background,#333);width:130px;height:40px}
#sidebar{width:152px}.bar{background:rgb(180,20,20);height:12px;width:70%}
@media(max-width:350px){.avatar{width:150px}.stats{width:110px}}
</style><body class="dark-mode"><main class="content-wrapper">
<div class="content-title"><h4>Example Profile</h4><a href="#profile">Profile</a></div>
<section class="cont-gray"><div class="avatar">Avatar</div><div class="stats"><div>Level 25</div><div>Rank</div><div>Age</div></div></section>
<section class="cont-white" style="padding:7px;border:1px solid #777">A native panel with its own padding</section>
<div class="crimes-app"><div class="appHeader___test crimes-app-header"><h4>Crimes</h4><a id="record" href="#record">Criminal Record</a><a href="#city">City</a></div></div>
<div id="attack-root"><div class="appHeaderWrapper___test">Attack</div></div>
<div class="appHeader___other">Another application</div><div class="dropdown">Dropdown options</div>
<aside id="sidebar"><div class="header___test">Information</div><div class="bar"></div></aside>
</main></body>`;
try{for(const width of [320,390,1440]){
 const page=await browser.newPage({viewport:{width,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/*',async route=>{const u=new URL(route.request().url());if(u.hostname==='www.torn.com')return route.fulfill({contentType:'text/html',body:fixture});
  const frame=await readFile(path.join(root,'assets/themes/candy-cartel-frame-chocolate-v2.webp'));return route.fulfill({contentType:'image/webp',body:frame});});
 await page.goto('https://www.torn.com/profiles.php?XID=123');
 const measure=()=>page.evaluate(()=>[...document.querySelectorAll('.content-title,.cont-gray,.cont-white,.avatar,.stats,.crimes-app-header,#attack-root>div,#sidebar,.bar')].map(e=>{
  const r=e.getBoundingClientRect(),s=getComputedStyle(e);return {x:r.x,y:r.y,w:r.width,h:r.height,padding:s.padding,border:s.borderWidth,box:s.boxSizing};
 }));
 const native=await measure();assert.equal(native[2].y,native[3].y,'Control profile columns must start on the same row');
 for(const file of sources)await page.addScriptTag({content:await readFile(path.join(sourceRoot,file),'utf8')});
 await page.evaluate(()=>{window.clicks=0;document.querySelector('#record').addEventListener('click',()=>window.clicks++);window.controller=SLINK_TORN_THEME.create({document});});
 for(const theme of ['slink-candy-cartel','slink-naughty-list']){
  await page.evaluate(theme=>controller.update({theme:{id:theme},settings:{enabled:true,frames:true,background:false,opacity:92},assetCss:{'--slink-theme-frame-image':'url("https://raw.githubusercontent.com/Considious/SLINK-Cloudflare-Services/main/themes/assets/candy-cartel-frame-chocolate-v2.webp")','--slink-theme-panel-smoke-image':'url("https://raw.githubusercontent.com/Considious/SLINK-Cloudflare-Services/main/themes/assets/candy-cartel-frame-chocolate-v2.webp")'}}),theme);
  assert.deepEqual(await measure(),native,'Frames must not change native box dimensions, float positions, padding or borders');
  const style=await page.evaluate(()=>{
   const alpha=e=>{const c=getComputedStyle(e).backgroundColor;return c.startsWith('color(')?Number(c.match(/\/\s*([\d.]+)/)?.[1]??1):Number(c.match(/rgba\([^,]+,[^,]+,[^,]+,\s*([\d.]+)/)?.[1]??1);};
   return {headers:[...document.querySelectorAll('.content-title,.crimes-app-header,.appHeader___other,#attack-root>div,#sidebar>.header___test')].map(e=>({alpha:alpha(e),image:getComputedStyle(e).backgroundImage})),dropdown:alpha(document.querySelector('.dropdown')),bar:getComputedStyle(document.querySelector('.bar')).backgroundColor,frame:getComputedStyle(document.querySelector('.cont-gray')).borderImageSource};
  });
  assert.ok(style.headers.every(h=>h.alpha<=.3&&h.image==='none'),JSON.stringify(style));assert.ok(style.dropdown>.9,JSON.stringify(style));assert.equal(style.bar,'rgb(180, 20, 20)');assert.match(style.frame,/candy-cartel-frame/);
 }
 await page.locator('#record').click();assert.equal(await page.evaluate(()=>window.clicks),1,'Header links must remain clickable');
 await page.screenshot({path:path.join(output,'native-layout-'+width+'.png'),fullPage:true});
 await page.evaluate(()=>controller.update({settings:{enabled:false}}));assert.deepEqual(await measure(),native);assert.equal(await page.locator('#slink-torn-page-theme').count(),0);assert.deepEqual(errors,[]);
 await page.close();console.log('PASS '+width+'px: frame/layout invariance, profile floats, app/sidebar header translucency, opaque dropdowns, status color, links and disable cleanup.');
}}finally{await browser.close();}
