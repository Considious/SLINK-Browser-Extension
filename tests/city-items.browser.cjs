const assert=require('node:assert/strict');
const path=require('node:path');
const {chromium}=require(process.env.SLINK_PLAYWRIGHT_MODULE||'playwright');
(async()=>{
 const browser=await chromium.launch({channel:'msedge'});
 try{for(const width of [390,1100]){
  const page=await browser.newPage({viewport:{width,height:800}});
  let extra=0;
  await page.route('https://www.torn.com/**',r=>{if(r.request().resourceType()!=='document')extra++;return r.fulfill({contentType:'text/html',body:'<div id="map" style="height:300px"><button class="city-item" data-id="7">Torn item</button></div>'});});
  await page.goto('https://www.torn.com/city.php#/p=map');
  await page.evaluate(()=>{
   let items=[{row_id:1,item_id:7,title:'Test item',coordinates:[40,60]}];
   const callbacks=new Set(),node=document.querySelector('#map');
   const map={on(){},off(){}};
   window.torn={model:{get:()=>items,on:(name,fn)=>callbacks.add(fn),off:(name,fn)=>callbacks.delete(fn)},map:{lmap:map,minZoom:3,getLPoint:xy=>xy}};
   window.L={CRS:{EPSG3857:{pointToLatLng:([lat,lng])=>({lat,lng})}},circleMarker:(coords,opts)=>{
    if(opts.interactive!==false)throw Error('Marker must not handle clicks');
    const dot=document.createElement('span');dot.className=opts.className;dot.dataset.coords=JSON.stringify(coords);
    return {addTo:()=>node.append(dot),remove:()=>dot.remove()};
   }};
   window.removeItem=()=>{items=[];node.querySelector('button')?.remove();for(const fn of callbacks)fn();};
   window.nativeClicks=0;node.querySelector('button').addEventListener('click',()=>window.nativeClicks++);
  });
  await page.addScriptTag({path:path.join(__dirname,'../src/content/city-items.js')});
  const guide=page.getByRole('region',{name:'SLINK City items'}),dot=page.locator('.slink-city-dot');
  await guide.getByText(/1 item shown/).waitFor();
  await guide.getByText('Item list',{exact:true}).click();await guide.getByText('Test item',{exact:true}).waitFor();
  assert.equal(await dot.getAttribute('data-coords'),'{"lat":20,"lng":30}');
  await guide.getByRole('checkbox').uncheck();await dot.waitFor({state:'detached'});
  await guide.getByRole('checkbox').check();await dot.waitFor({state:'attached'});
  assert.equal(await page.evaluate(()=>nativeClicks),0);
  await page.getByRole('button',{name:'Torn item'}).click();
  await page.evaluate(()=>removeItem());
  await guide.getByText(/loaded map has no items/).waitFor();await dot.waitFor({state:'detached'});
  await page.evaluate(()=>location.hash='#/p=bank');await guide.waitFor({state:'detached'});
  assert.equal(extra,0);await page.close();
 }}finally{await browser.close();}
 console.log('City items: desktop/mobile, item list, toggle, native collection cleanup and no extra requests passed');
})().catch(e=>{console.error(e);process.exitCode=1;});
