import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const read = name => fs.readFileSync(new URL('../'+name, import.meta.url),'utf8');
const event = () => ({ addListener() {} });
const worker = read('src/background/service-worker.js');
const source = worker.slice(worker.indexOf('let activeTornPageTabId'), worker.indexOf('chrome.runtime.onMessage.addListener(SLINK.core.messaging.createRouter(routes))'));
let selected=1, focused=true, revoked=null, release=null;
const notifications=[];
const context=vm.createContext({URL, console, SLINK:{core:{format:{errorMessage:String}}},chrome:{
  tabs:{query:async()=>[{id:selected,url:selected===9?'https://example.com/':'https://www.torn.com/index.php'}],onActivated:event(),onRemoved:event(),onUpdated:event(),
    sendMessage:async(id,message)=>{notifications.push({id,...message});if(!message.active&&revoked){const wait=revoked;revoked=null;await wait;}}},
  windows:{getAll:async()=>[{id:100,focused,state:'normal'}],onFocusChanged:event()},runtime:{onMessage:event()}
}});
vm.runInContext(source,context);
await context.reconcileTornPageActivity();
assert.equal(await context.claimTornPageActivity(2),false,'A visible but non-active tab cannot claim ownership.');
focused=false;await context.reconcileTornPageActivity();
assert.equal(await context.claimTornPageActivity(1),false,'No Chrome focus means no owner.');
focused=true;selected=9;await context.reconcileTornPageActivity();
assert.equal(await context.claimTornPageActivity(9),false,'Non-Torn pages cannot own scraping.');
selected=1;await context.reconcileTornPageActivity();notifications.length=0;
revoked=new Promise(resolve=>release=resolve);selected=2;
const b=context.claimTornPageActivity(2);
while(!notifications.some(item=>item.id===1&&!item.active))await new Promise(resolve=>setImmediate(resolve));
selected=3;const c=context.claimTornPageActivity(3);release();
assert.equal(await b,false);assert.equal(await c,true);
assert.equal(notifications.some(item=>item.id===2&&item.active),false,'Superseded B must never get a delayed active grant.');
// Worker restart: reconstruct from focused tab; no persistent owner record needed.
vm.runInContext('activeTornPageTabId=null',context);
assert.equal(await context.claimTornPageActivity(3),true);

const api={core:{permissions:{hasAllScopes:()=>true},format:{errorMessage:String}},define(group,key,value){(this[group]??={})[key]=value;}};
const modulesContext=vm.createContext({SLINK_EXTENSION:api,console,AbortController});
vm.runInContext(read('src/core/modules.js'),modulesContext);
let starts=0,stops=0,clicks=0,paint=0,removed=0;
const listeners=new Set();const target={addEventListener(_type,fn){listeners.add(fn);},removeEventListener(_type,fn){listeners.delete(fn);}};
let finish;
api.modules.register({id:'sample',start:async context=>{
 starts++;context.listen(target,'click',()=>clicks++);
 if(starts===1)await new Promise(resolve=>finish=resolve);
 context.ui.setContentHtml('ready');
 return{stop(){stops++;}};
}});
const host={url:new URL('https://www.torn.com/'),permissions:{},ui:{setContentHtml(){paint++;},remove(){removed++;}}};
const pending=api.modules.startAll(host);
await Promise.resolve();api.modules.invalidate();
for(const fn of listeners)fn();assert.equal(clicks,0,'Invalidation removes handlers before async startup finishes.');
finish();await pending;assert.equal(paint,0,'Late startup cannot redraw an invalidated module.');
for(let n=0;n<4;n++){
 await api.modules.startAll(host);assert.equal(listeners.size,1);
 for(const fn of listeners)fn();
 await api.modules.stopAll({preserveUi:true});assert.equal(listeners.size,0);
}
assert.equal(clicks,4);assert.equal(stops,5);assert.equal(removed,0,'Suspending preserves the mounted UI.');
// One broken cleanup must not prevent every other module from being stopped.
api.modules.register({id:'broken-cleanup',start:()=>({stop(){throw Error('injected stop failure');}})});
await api.modules.startAll(host);await api.modules.stopAll({preserveUi:true});assert.equal(listeners.size,0);
console.log('Activity arbitration and lifecycle: focused ownership, stale grant rejection, worker recovery, immediate invalidation, late paint, retained-root handlers and cleanup recovery passed.');

// Exercise the actual content transition queue, including false->true before
// an earlier startup has released its await. No DOM or network implementation
// is substituted for the queue itself.
const content=read('src/content/content-script.js');
let contentStarts=0,contentStops=0,invalidation=0,releasePermissions;
const permissionsWait=new Promise(resolve=>releasePermissions=resolve);
const transitionContext=vm.createContext({console,document:{visibilityState:'visible',hasFocus:()=>true},
  SLINK:{core:{pageActivity:{setGranted(){}}},modules:{invalidate(){invalidation++;},async stopAll(){contentStops++;}}},
  stopRuntimeTimers(){},async reloadThemeAndPermissions(){return permissionsWait;},
  async startModules(){contentStarts++;},async startRuntimeTimers(){}});
vm.runInContext('let runtimeActive=false, activityGeneration=0, activityTransition=Promise.resolve(),activityNeedsCleanup=false, initialized=true,modulesRunning=false;'+content.slice(content.indexOf('  async function applyRuntimeActivity('),content.indexOf('  async function claimRuntimeActivity(')),transitionContext);
const starting=transitionContext.applyRuntimeActivity(true);await Promise.resolve();
const inactive=transitionContext.applyRuntimeActivity(false);
assert.equal(invalidation,1,'Local deactivation happens before permission/startup resolves.');
const resumed=transitionContext.applyRuntimeActivity(true);
releasePermissions({});await Promise.all([starting,inactive,resumed]);
assert.equal(contentStarts,1);assert.equal(contentStops,1,'A superseded pause still cleans invalidated workers before resuming.');
console.log('Content transition queue: immediate revocation and rapid pause/resume recovery passed.');

const pageEvents=new Map(),pageApi={core:{},define(group,key,value){this[group][key]=value;}};
const pageScope=vm.createContext({console:{warn(){}},document:{visibilityState:'visible',hasFocus:()=>true,addEventListener:(type,fn)=>pageEvents.set(type,fn)},addEventListener:(type,fn)=>pageEvents.set(type,fn),SLINK_EXTENSION:pageApi});
vm.runInContext(read('src/core/page-activity.js'),pageScope);
let remainingSubscriberCalls=0;
pageApi.core.pageActivity.subscribe(()=>{throw Error('broken subscriber');});
pageApi.core.pageActivity.subscribe(()=>{remainingSubscriberCalls++;});
pageApi.core.pageActivity.setGranted(true);const grantedToken=pageApi.core.pageActivity.token();
pageEvents.get('pagehide')();assert.equal(pageApi.core.pageActivity.current(grantedToken),false);assert.equal(remainingSubscriberCalls,2,'One subscriber failure must not block other modules pausing');
pageEvents.get('pageshow')();assert.equal(pageApi.core.pageActivity.eligible(),false,'Return alone must not restore the extension worker grant');
pageApi.core.pageActivity.setGranted(true);pageScope.document.hasFocus=()=>false;assert.equal(pageApi.core.pageActivity.eligible(),false,'Extension focus requirements remain unchanged');
console.log('Page activity fault isolation retains worker grant and desktop focus requirements.');
