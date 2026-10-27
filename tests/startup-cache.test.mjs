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
let starts=0,stops=0,themeRequests=0,optionsSeen,batchReads=0;
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
  }}},modules:{startAll:async()=>{starts++;return {};},stopAll:async()=>{stops++;},invalidate(){}}};
let focused=true;
const activityEvents=new Map();
const doc={visibilityState:'visible',hasFocus:()=>focused,addEventListener(){}};
const chrome={storage:{local:{get:async keys=>{batchReads++;return Object.fromEntries(keys.filter(key=>Object.hasOwn(startup,key.slice(6))).map(key=>[key,startup[key.slice(6)]]));}},onChanged:{addListener:fn=>storageListeners.push(fn)}},
  runtime:{id:'fixture',sendMessage:async()=>({active:true}),onMessage:{addListener:fn=>runtimeListeners.push(fn)}}};
const contentContext=vm.createContext({console,document:doc,chrome,SLINK_EXTENSION:slink,URL,location:{href:'https://www.torn.com/index.php'},
  localStorage:{getItem:()=>null,setItem(){}},addEventListener:(type,fn)=>activityEvents.set(type,fn),dispatchEvent(){},setInterval:()=>1,clearInterval(){},CustomEvent:class{}});
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
await new Promise(resolve=>{
  // The first runtime listener handles ownership.
  runtimeListeners[0]({channel:'slink-page-activity',type:'active-state',active:false},null,resolve);
});
assert.equal(stops,1,'Inactive tabs must still pause workers');
focused=false;activityEvents.get('focus')();await new Promise(resolve=>setTimeout(resolve,0));
assert.equal(starts,1,'A visible but unfocused window must not start workers');
focused=true;activityEvents.get('focus')();await new Promise(resolve=>setTimeout(resolve,0));assert.equal(starts,2);
focused=false;activityEvents.get('blur')();await new Promise(resolve=>setTimeout(resolve,0));
assert.equal(stops,2,'Window blur must release workers without destroying the retained shell');
console.log('Cached startup, stalled remote services, batched UI preferences, permission write deduplication/expiry and activity suspension passed.');

