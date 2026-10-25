import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const read=path=>fs.readFileSync(new URL('../'+path,import.meta.url),'utf8');
const context=vm.createContext({console,URL,AbortController,crypto:{randomUUID:()=> 'generated'},location:{href:'https://dashboard.test/'}});
for(const file of ['runtime','permissions','modules','dashboard-host'])vm.runInContext(read('src/core/'+file+'.js'),context);
const api=context.SLINK_EXTENSION;
let permissions={scopes:['slink.qol.company']},visible=true,starts=0,stops=0,opened='';
const nodes=new Map();
const node=()=>({textContent:'',hidden:false,dataset:{},innerHTML:'',replaceChildren(){},append(){},addEventListener(){},removeEventListener(){}});
const panel={querySelector:selector=>{if(!nodes.has(selector))nodes.set(selector,node());return nodes.get(selector);},addEventListener(){},removeEventListener(){}};
const document={querySelector:()=>panel,getElementById:()=>null,createElement:node,head:{append(){}}};
context.document=document;context.open=url=>opened=url;
let adapter,resolveSlow;
api.modules.register({id:'fixture',requiredScopes:['slink.qol.company'],start:async ctx=>{starts++;adapter=ctx.ui;ctx.ui.setContentHtml('current');return {stop(){stops++;}};}});
api.modules.register({id:'slow',requiredScopes:['slink.qol.company'],start:async ctx=>{starts++;await new Promise(resolve=>resolveSlow=resolve);ctx.ui.setContentHtml('stale');return {stop(){stops++;}};}});
const host=api.core.dashboardHost.create({permissions:()=>permissions,visible:()=>visible,root:document});
await host.select('fixture');assert.equal(starts,1);assert.equal(nodes.get('[data-host-content]').innerHTML,'current');
await host.select('fixture');assert.equal(starts,1,'Repeated selection must not restart a module.');
adapter.navigateTo('war');assert.equal(opened,'https://www.torn.com/factions.php?step=your#/tab=armoury');
permissions={scopes:[]};await host.select('fixture');assert.equal(stops,1,'Revocation must stop the running module.');
adapter.setContentHtml('revoked');assert.equal(nodes.get('[data-host-content]').innerHTML,'current');
permissions={scopes:['admin.*']};assert.equal(host.allowed('fixture'),true);
visible=false;await host.select('fixture');assert.equal(starts,1,'Hidden hosts must not start modules.');
visible=true;const slow=host.select('slow');while(!resolveSlow)await new Promise(resolve=>setImmediate(resolve));
const stopped=host.stop();resolveSlow();await slow;await stopped;
assert.equal(nodes.get('[data-host-content]').innerHTML,'current','Late startup must not render after cancellation.');
assert.equal(stops,2,'Late startup must still be cleaned up.');

const store=new Map();let fail=false;
api.core.storage={get:async(key,fallback)=>structuredClone(store.get(key)??fallback),set:async(key,value)=>{if(fail){fail=false;throw Error('disk failure');}store.set(key,structuredClone(value));}};
api.services.permissionAccess={ensureSession:async()=>permissions};
vm.runInContext(read('src/background/chat-config-service.js'),context);
const routes=api.services.chatConfig.routes;
const legacy={id:'old',label:'Legacy',message:'<a href="https://www.torn.com/">Torn</a>',scope:'both',enabled:true};
let config=await routes['chat.macros.importLegacy']({macros:[legacy]});assert.equal(config.macros.length,1);
config=await routes['chat.macros.save']({expectedRevision:config.revision,macros:[]});
assert.equal((await routes['chat.macros.importLegacy']({macros:[legacy]})).macros.length,0,'Deleted macros must not be resurrected by legacy import.');
await assert.rejects(routes['chat.macros.save']({expectedRevision:0,macros:[legacy]}),/another page/);
fail=true;await assert.rejects(routes['chat.macros.save']({expectedRevision:config.revision,macros:[legacy]}),/disk failure/);
config=await routes['chat.macros.save']({expectedRevision:config.revision,macros:[legacy]});assert.equal(config.macros[0].message,legacy.message);
permissions={scopes:[]};await assert.rejects(routes['chat.macros.get'](),/permission/);
permissions={scopes:['slink.qol.chat']};assert.equal((await routes['chat.macros.get']()).macros.length,1);
await assert.rejects(routes['chat.macros.save']({expectedRevision:config.revision,macros:[{...legacy,label:''}]}),/Each button/);
const html=read('src/dashboard/dashboard.html');
for(const file of ['bounties','mugging','target-list','chat'])assert.ok(html.includes('../modules/'+file+'.js'));
assert.ok(!html.includes('player-intelligence-dom.js'),'Dashboard must not import Torn-page scraping.');
for(const [id,scope] of [['bounties','slink.combat.bounties'],['mugging','slink.mugging'],['target-list','slink.combat.target-list'],['chat','slink.qol.chat']]){
  vm.runInContext(read('src/modules/'+id+'.js'),context);
  const definition=api.modules.list().find(module=>module.id===id);
  assert.equal(api.modules.canAccess(definition,{scopes:[scope]}),true);
  assert.equal(api.modules.canAccess(definition,{scopes:['admin.*']}),true);
  assert.equal(api.modules.canAccess(definition,{scopes:[]}),false);
}
// Opening the dashboard without a requested destination preserves the saved page.
const worker=read('src/background/service-worker.js');
const routeStart=worker.indexOf("  async 'ui.dashboard.open'");
const routeEnd=worker.indexOf("  async 'diagnostics.run'",routeStart);
let optionsOpened=0;context.chrome={runtime:{openOptionsPage:async()=>optionsOpened++}};
context.SLINK=api;
store.set('ui.dashboard.activePage','quality');
const navigation=vm.runInContext('({'+worker.slice(routeStart,routeEnd)+'})',context);
assert.equal((await navigation['ui.dashboard.open']({})).page,'quality');
await navigation['ui.dashboard.open']({page:'workspace',combatView:'target-list'});
assert.equal(store.get('ui.dashboard.combatView'),'target-list');assert.equal(optionsOpened,2);
const dashboardSource=read('src/dashboard/dashboard.js'),savedPayloads=[];
api.core.messaging={send:async(type,payload)=>{assert.equal(type,'targetList.add');savedPayloads.push(payload);}};
context.hasScope=()=>true;context.errorText=error=>error.message;
context.document.createElement=()=>({addEventListener(type,fn){this.click=fn;}});
vm.runInContext(dashboardSource.slice(dashboardSource.indexOf('  function addSavedTargetAction('),dashboardSource.indexOf('  function targetCard(')),context);
for(const source of ['leveling','war','outside']){
  let button;context.addSavedTargetAction({querySelector:()=>({append:value=>button=value})},{id:42,name:'Tester'},source);await button.click();
}
assert.deepEqual(savedPayloads.map(row=>row.source),['leveling','war','outside-targets']);
assert.deepEqual(savedPayloads.map(row=>row.tags[0]),['Level','War','War']);
context.hasScope=()=>false;
context.addSavedTargetAction({querySelector(){throw Error('Denied action must not be added.');}},{id:42},'war');
// The existing Torn chat editor is now asynchronous: an acknowledgement must
// not close newer typing or replace the legacy mirror before durable acceptance.
const chatSource=read('src/content/custom-chat-buttons.js');
const saveStart=chatSource.indexOf('  async function saveEditor()');
const saveEnd=chatSource.indexOf('  function addStyles()',saveStart);
let releaseSave,closed=0;
const editorContext=vm.createContext({editor:{},editorDraft:[{id:'one',label:'One',message:'Hello',scope:'both'}],
 savingEditorData:false,SCOPES:new Set(['both']),NEWSLETTER_FALLBACK_LIMIT:60000,
 scopeUsesNewsletter:()=>false,normalizeMacros:value=>value,
 saveMacros:()=>new Promise(resolve=>releaseSave=resolve),clearArmed(){},closeEditor(){closed++;},scanContexts(){},window:{alert(){throw Error('Unexpected editor failure.');}}});
vm.runInContext(chatSource.slice(saveStart,saveEnd),editorContext);
const save=editorContext.saveEditor();editorContext.editorDraft[0].message='Newer typing';releaseSave();await save;
assert.equal(closed,0,'A pending macro save must not close newer typing.');
const secondSave=editorContext.saveEditor();releaseSave();await secondSave;assert.equal(closed,1);
console.log('Dashboard host: exact/admin/denied access, revocation, visibility, stale startup, Recaller handoff and safe macro migration passed.');
