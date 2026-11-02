import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const read=path=>fs.readFileSync(new URL('../'+path,import.meta.url),'utf8');
let now=1800000000000,writes=0;
const values=new Map([['permissions.access',{userId:42,roles:[],scopes:['slink.adhd.alerts'],issuedAt:now-1000,expiresAt:now+60000}]]);
const api={core:{storage:{get:async(key,fallback)=>structuredClone(values.get(key)??fallback),set:async(key,value)=>{writes++;values.set(key,structuredClone(value));}}},define(group,name,value){this[group]||={};this[group][name]=value;}};
const context=vm.createContext({Date:class extends Date{static now(){return now;}},SLINK_EXTENSION:api});
vm.runInContext(read('src/core/permissions.js'),context);
await api.core.permissions.recomputeStoredSnapshot();
const afterFirst=writes;
now+=1000;
await api.core.permissions.recomputeStoredSnapshot();
assert.equal(writes,afterFirst,'Unchanged permissions must not emit storage changes on reread');
const worker=read('src/background/service-worker.js');
const workerContext=vm.createContext({SLINK:api,bootstrapPermissions:()=>({userId:null,roles:['foundation'],scopes:[],issuedAt:now})});
vm.runInContext(worker.slice(worker.indexOf('async function getPermissionSnapshot('),worker.indexOf('async function ensureDefaultState(')),workerContext);
await workerContext.getPermissionSnapshot();
assert.equal(writes,afterFirst,'permissions.get must not rewrite the snapshot just because time changed');
values.get('permissions.access').scopes.push('slink.mugging');
await api.core.permissions.recomputeStoredSnapshot();
assert.equal(writes,afterFirst+1,'Real grant changes must still persist');
now+=60000;
const expired=await api.core.permissions.recomputeStoredSnapshot();
assert.equal(expired.scopes.length,0,'Expired product grants must not survive cached startup');

const product={userId:42,roles:[],scopes:['slink.adhd.alerts'],issuedAt:now,expiresAt:now+60000};
const startup={'permissions.access':product,'theme.id':'halloween-2026','theme.catalog':{catalog:{revision:'cached'}},'ui.main.position':{left:20,top:30},'ui.main.size':{width:500,height:600}};
let starts=0,stops=0,themeRequests=0,optionsSeen,batchReads=0;const scopedRestarts=[];
const storageListeners=[],runtimeListeners=[];
const forever=new Promise(()=>{});
const ui={ready:Promise.resolve(),setHidden(){},setTheme(){},setThemePanelOpacity(){},setCollapsed(){},setMinimizedMode(){},restore(){}};
const slink={core:{permissions:api.core.permissions,storage:{fullKey:key=>'slink.'+key,get:async(key,fallback)=>startup[key]??fallback},
  themes:{STORAGE_KEY:'theme.id',CATALOG_STORAGE_KEY:'theme.catalog',PANEL_OPACITY_STORAGE_KEY:'theme.opacity',DEFAULT_PANEL_OPACITY:87,DEFAULT_THEME_ID:'slink-dark',installCatalog(){}},
  uiShell:{createShell:options=>{optionsSeen=options;return ui;}},format:{errorMessage:String},
  pageActivity:{setGranted(){},eligible:()=>true},messaging:{send:async type=>{
    if(type==='themes.catalog'){themeRequests++;return forever;}
    if(type==='content.ready')return forever;
    if(type==='permissions.get')return product;
    return {};
  }}},modules:{list:()=>['war','company','faction-rooms'].map(id=>({id,defaultShowInTorn:true})),restartOne:async id=>{scopedRestarts.push(id);},startAll:async()=>{starts++;return {};},stopAll:async()=>{stops++;},invalidate(){}}};
const doc={visibilityState:'visible',hasFocus:()=>true,addEventListener(){}};
const chrome={storage:{local:{get:async keys=>{batchReads++;return Object.fromEntries(keys.filter(key=>Object.hasOwn(startup,key.slice(6))).map(key=>[key,startup[key.slice(6)]]));}},onChanged:{addListener:fn=>storageListeners.push(fn)}},
  runtime:{id:'fixture',sendMessage:async()=>({active:true}),onMessage:{addListener:fn=>runtimeListeners.push(fn)}}};
const contentContext=vm.createContext({console,document:doc,chrome,SLINK_EXTENSION:slink,URL,location:{href:'https://www.torn.com/index.php'},
  localStorage:{getItem:()=>null,setItem(){}},addEventListener(){},dispatchEvent(){},setInterval:()=>1,clearInterval(){},CustomEvent:class{}});
await vm.runInContext(read('src/content/content-script.js'),contentContext);
assert.equal(starts,1,'A stalled theme service or registration message must not block cached module startup');
assert.equal(batchReads,1,'Initial shell preferences should use one bounded storage batch');
assert.equal(optionsSeen.themeId,'halloween-2026','First shell construction must use the saved theme');
assert(optionsSeen.permissions.scopes.includes('slink.adhd.alerts'),'Valid cached grants must be available at first construction');
assert.equal(optionsSeen.preferences['ui.main.position'].left,20);
assert.equal(themeRequests,1,'Do not perform duplicate serialized theme requests during initial startup');
for(const listener of storageListeners)listener({'slink.permissions.snapshot':{oldValue:product,newValue:{...product,issuedAt:Date.now()+1,expiresAt:Date.now()+120000}}});
await Promise.resolve();await Promise.resolve();
assert.equal(stops,0,'Timestamp-only permission renewals must not restart modules');
for(let index=0;index<12;index++)for(const listener of storageListeners)listener({'slink.war.settings.v1':{oldValue:{displayMode:'torn',minFF:1},newValue:{displayMode:'torn',minFF:1+index/10,retalAlerts:index%2===0}}});
await new Promise(resolve=>setImmediate(resolve));
assert.equal(stops,0,'Repeated unrelated War preference writes must not destroy room-management forms');
assert.equal(starts,1,'Routine storage updates must not trigger new settings/member-directory requests');
for(const listener of storageListeners)listener({'slink.war.settings.v1':{oldValue:{},newValue:{displayMode:'torn'}}});
await new Promise(resolve=>setImmediate(resolve));assert.equal(stops,0,'Default and explicit Torn display mode are the same presentation');
for(const listener of storageListeners)listener({'slink.war.settings.v1':{oldValue:{displayMode:'torn'},newValue:{displayMode:'hybrid'}}});
await new Promise(resolve=>setImmediate(resolve));
assert.equal(stops,0,'Even a real War display-mode change must not stop other modules');assert.equal(starts,1);assert.deepEqual(scopedRestarts,['war']);
for(const listener of storageListeners)listener({'slink.ui.modules.company.showInTorn':{oldValue:true,newValue:false}});
await new Promise(resolve=>setImmediate(resolve));assert.deepEqual(scopedRestarts,['war','company'],'Visibility changes target only the module owning the setting');assert.equal(stops,0);
await new Promise(resolve=>{
  // The first runtime listener handles ownership.
  runtimeListeners[0]({channel:'slink-page-activity',type:'active-state',active:false},null,resolve);
});
assert.equal(stops,1,'Inactive tabs must still pause workers');
let roomDefinition,finishRoomSettings;const roomStatuses=[],roomInstance={stop(){}};
const roomContext=vm.createContext({SLINK_EXTENSION:{modules:{register:definition=>{roomDefinition=definition;}}},SLINK_FACTION_NODE_SETTINGS:()=>new Promise(resolve=>{finishRoomSettings=resolve;})});
vm.runInContext(read('src/modules/faction-rooms.js'),roomContext);
const roomStart=roomDefinition.start({ui:{getContentElement:()=>({}),setStatus:value=>roomStatuses.push(value)}});
assert.equal(roomStatuses.length,0,'Do not clear loading before saved settings finish initializing');
finishRoomSettings(roomInstance);assert.equal(await roomStart,roomInstance);assert.deepEqual(roomStatuses,[''],'Clear the stale Loading saved state label once settings are mounted');

const isolated={core:{permissions:{hasAllScopes:()=>true},format:{errorMessage:String}},define(group,key,value){(this[group]??={})[key]=value;}};
vm.runInContext(read('src/core/modules.js'),vm.createContext({SLINK_EXTENSION:isolated,AbortController,console}));
const views=new Map(),runs={war:0,rooms:0},stopped={war:0,rooms:0},signals={};
for(const id of ['war','rooms'])isolated.modules.register({id,start:context=>{runs[id]++;signals[id]=context.signal;return {stop(){stopped[id]++;}};}});
const hostContext={url:new URL('https://www.torn.com/'),permissions:{},isActive:()=>true,ui:{createModuleView:async module=>{const view={draft:module.id==='rooms'?'Unfinished room name':'',setStatus(){},remove(){views.delete(module.id);}};views.set(module.id,view);return view;}}};
await isolated.modules.startAll(hostContext);const retained=views.get('rooms'),roomSignal=signals.rooms;
await isolated.modules.restartOne('war',hostContext);
assert.deepEqual(runs,{war:2,rooms:1});assert.deepEqual(stopped,{war:1,rooms:0});assert.equal(views.get('rooms'),retained);assert.equal(retained.draft,'Unfinished room name');assert.equal(roomSignal.aborted,false,'War changes never invalidate another module lifecycle');
await isolated.modules.restartOne('war',{...hostContext,modulePresentation:module=>module.id==='war'?'hidden':'full'});
assert.equal(views.has('war'),false);assert.equal(views.get('rooms'),retained);assert.equal(stopped.rooms,0);
let releaseOld,lateStarts=0,latePaint=0;
isolated.modules.register({id:'deferred',async start(context){if(++lateStarts===1)await new Promise(resolve=>releaseOld=resolve);context.ui.setContentHtml('ready');return {stop(){}};}});
const lateContext={...hostContext,ui:{createModuleView:async()=>({setStatus(){},setContentHtml(){latePaint++;},remove(){}})}};
const oldStart=isolated.modules.startAll({...lateContext,moduleIds:['deferred']});await new Promise(resolve=>setImmediate(resolve));
await isolated.modules.restartOne('deferred',lateContext);releaseOld();await oldStart;
assert.equal(lateStarts,2);assert.equal(latePaint,1,'Late startup cannot repaint after its own scoped replacement');assert.equal(views.get('rooms'),retained);
await isolated.modules.stopAll();
console.log('Cached startup, stalled remote services, batched UI preferences, permission write deduplication/expiry and activity suspension passed.');
