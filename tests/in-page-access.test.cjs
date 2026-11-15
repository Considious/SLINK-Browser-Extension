const {readFileSync}=require('node:fs');
const assert=require('node:assert/strict');
const {test}=require('node:test');
const {join}=require('node:path');
const exercise=async (source,check)=>{
  let definition;
  new Function('globalThis',source('src/modules/access.js'))({SLINK_EXTENSION:{core:{},modules:{register(value){definition=value;}}}});
  check(definition?.id==='access'&&definition?.group==='access','Access registers in Torn');
  const manifest=JSON.parse(source('manifest.json'));
  const scripts=manifest.content_scripts.find(entry=>entry.js.includes('src/content/content-script.js')).js;
  check(scripts.indexOf('src/core/access-usage.js')<scripts.indexOf('src/modules/access.js')&&scripts.indexOf('src/modules/access.js')<scripts.indexOf('src/content/content-script.js'),'Access loads before the shell starts');
  check(!scripts.includes('src/access/credentials.js')&&manifest.web_accessible_resources.some(entry=>entry.matches.length===1&&entry.matches[0]==='https://www.torn.com/*'&&entry.resources.includes('src/access/credentials.html')),'The credential UI runs in its own extension document');

  const data=new Map([['market.activity.v1',{lastActiveAt:Date.now()}]]);
  const alarms=new Set(['slink.market.watch','slink.market.dollar-bazaars']);
  const storage={get:async(key,fallback)=>data.has(key)?data.get(key):fallback,set:async(key,value)=>data.set(key,value)};
  const runtime={core:{storage,http:{requestJson:()=>{throw Error('Unexpected network');}}},services:{},define(group,key,value){this[group][key]=value;}};
  const global={SLINK_EXTENSION:runtime};
  new Function('globalThis',source('src/core/market.js'))(global);
  const testSettings=runtime.core.market.normalizeSettings({enabled:true,watches:[{uid:'watch-42',itemId:42,enabled:true,maxPrice:100}]});
  data.set('market.settings.v1',{...testSettings,custom:'keep'});
  new Function('globalThis','chrome',source('src/background/market-service.js'))(global,{alarms:{clear:async key=>alarms.delete(key),get:async key=>alarms.has(key),create:async key=>alarms.add(key)}});
  const market=runtime.services.market;
  await market.routes['market.monitor.setEnabled']({enabled:false});
  await market.ensureAlarm();
  await market.routes['market.activity.touch']();
  check(!alarms.has('slink.market.watch')&&alarms.has('slink.market.dollar-bazaars'),'Pausing Market Watch stops its alarm without affecting Dollar Bazaars');
  const paused=data.get('market.settings.v1');
  check(paused.enabled===false&&JSON.stringify(paused.watches)===JSON.stringify(testSettings.watches)&&paused.custom==='keep','Pausing preserves saved watches and preferences');

  data.set('ui.monitoring.dollarBazaars.enabled',false);
  await market.ensureDollarAlarm();
  const dollar=await market.routes['market.dollar.refresh']();
  check(!alarms.has('slink.market.dollar-bazaars')&&!dollar.fetchedAt&&!dollar.lastError,'Paused Dollar Bazaars clears its own alarm and skips fetch');
  const saved=await market.routes['market.watch.listSaved']();
  check(saved.length===1&&saved[0].itemId===undefined,'Saved watch list exposes only the fields used by Access');
  const removed=await market.routes['market.watch.removeSaved']({uid:saved[0].uid});
  check(removed.length===0&&!alarms.has('slink.market.watch'),'Remove saved watch without signing in or waking Market Watch');

  data.set('ui.monitoring.merits.enabled',false);
  runtime.services.permissionAccess={status:async()=>({configured:true}),ensureSession:async()=>{throw Error('Unexpected auth');}};
  runtime.core.permissions={hasScope:()=>true};
  runtime.core.tornApiLimiter={getUsage:async()=>({}),reserve:async()=>{throw Error('Unexpected request reservation');}};
  runtime.core.merits={REQUIRED_SCOPE:'test',normalizeSettings:value=>value,buildView:(snapshot,settings)=>({settings})};
  new Function('globalThis',source('src/background/merits-service.js'))(global);
  const merits=await runtime.services.merits.routes['merits.refresh']();
  check(merits.configured===true&&!merits.lastError&&!merits.fetchedAt,'Paused Merits skips authentication and Torn requests');

  runtime.core.adhd={marketWatchLimit:permission=>permission?.limit||0};
  const lockedEditor=await market.routes['market.watch.editor']({loadCatalog:true,includeCatalog:true});
  check(!lockedEditor.permitted&&lockedEditor.items===null,'Locked editor does not retrieve a catalogue or require auth');
  data.set('access.session.v1',{token:'test',limit:5,expiresAt:Date.now()+100000});
  data.set('market.runtime.v1',{catalog:{items:[{id:42,name:'Test item',unneeded:'private'}]}});
  const editor=await market.routes['market.watch.editor']({includeCatalog:true});
  check(editor.permitted&&editor.limit===5&&editor.items[0].name==='Test item'&&!editor.items[0].unneeded,'Active editor uses the cached minimal catalogue');
  new Function('globalThis',source('src/core/market-watch-editor.js'))(global);
  const fields={type:{value:'item'},itemId:{value:'42'},price:{value:'173'},priority:{value:'high'},market:{checked:true},bazaar:{checked:false},enabled:{checked:true}};
  const item=global.SLINK_MARKET_WATCH_EDITOR.watchInput(fields,'old-uid',()=>{throw Error('An edit must not generate another UID');});
  check(item.requireExisting&&item.uid==='old-uid'&&item.itemId===42&&item.maxPrice===173&&item.marketEnabled&&!item.bazaarEnabled,'Item edits preserve UID and chosen sources');
  fields.type.value='points';
  const points=global.SLINK_MARKET_WATCH_EDITOR.watchInput(fields,'',()=>'new-uid');
  check(!points.requireExisting&&points.uid==='new-uid'&&points.itemId===0&&points.marketEnabled&&!points.bazaarEnabled,'Points ignore item-only settings');

  const worker=source('src/background/service-worker.js');
  const accessRoutes=worker.slice(worker.indexOf("  async 'access.inPage.status'()"),worker.indexOf("  async 'tornApi.accessUsage'()"));
  const mock={core:{storage,permissions:{hasScope:()=>false}},services:{permissionAccess:{settings:async()=>({tornKey:'fixture-secret',ffKey:'fixture-ff'}),ensureSession:async()=>({token:'fixture-token'})}}};
  const routes=new Function('SLINK','chrome','getPermissionSnapshot','const routes={'+accessRoutes+'};return routes;')(mock,{runtime:{getURL:path=>'chrome-extension://slink/'+path}},async()=>({scopes:[]}));
  const status=JSON.stringify(await routes['access.inPage.status']());
  check(!status.includes('fixture-')&&JSON.parse(status).hasTornKey,'Access status is redacted');
  let rejected=false;
  try{await routes['access.inPage.credentials']({},{url:'https://www.torn.com/'});}catch{rejected=true;}
  check(rejected,'The credential route refuses a Torn page sender');
  check(!JSON.stringify(await routes['access.inPage.verify']()).includes('token'),'Verification never returns the session token');
};
test('Torn Access registration, credential isolation, and Market pause',()=>exercise(path=>readFileSync(join(__dirname,'..',path),'utf8'),(value,message)=>assert.ok(value,message)));
