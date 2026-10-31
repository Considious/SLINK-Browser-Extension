import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const read=name=>fs.readFileSync(new URL('../'+name,import.meta.url),'utf8');
const deferred=()=>{let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return {promise,resolve,reject};};
const document={activeElement:null};
class Element {
  constructor(tag='DIV'){this.tagName=tag;this.dataset={};this.listeners={};this.controls=[];this.hidden=false;this.isConnected=true;this.textContent='';}
  matches(selector){
    if(selector==='[data-ui-autosave="true"]'||selector==='[contenteditable="true"]')return false;
    return /input|textarea|select|details/.test(selector)&&['INPUT','SELECT','TEXTAREA','DETAILS'].includes(this.tagName);
  }
  closest(selector){
    if(selector==='.module-view'||selector.includes('data-slink-module-id'))return view;
    if(selector.includes('data-ui-explicit-commit'))return content;
    if(selector.includes('button')&&this.tagName==='BUTTON')return this;
    return this.parentElement||null;
  }
  querySelectorAll(selector){return this.controls.filter(control=>control.matches(selector));}
  querySelector(selector){if(selector==='.bounty-settings')return form;return nodes.get(selector.slice(1))||null;}
  contains(node){return node===this||this.controls.includes(node);}
  addEventListener(type,fn){(this.listeners[type]??=[]).push(fn);}
  removeEventListener(type,fn){this.listeners[type]=(this.listeners[type]||[]).filter(value=>value!==fn);}
  emit(type,target=this){for(const fn of this.listeners[type]||[])fn({target});}
  async click(){shadow.emit('click',this);await Promise.all((this.listeners.click||[]).map(fn=>fn({target:this})));}
  focus(){document.activeElement=this;shadow.activeElement=this;}
  setSelectionRange(start,end,direction){this.selectionStart=start;this.selectionEnd=end;this.selectionDirection=direction;}
  getRootNode(){return shadow;}
}
class HTMLInputElement extends Element {constructor(id,type,value=''){super('INPUT');this.id=id;this.type=type;this.value=value;this.checked=false;}}
class HTMLSelectElement extends Element {constructor(id,value){super('SELECT');this.id=id;this.value=value;}}
const shadow=new Element(),content=new Element(),view=new Element(),form=new Element();
view.dataset.slinkModuleId='bounties';view.hidden=true;
let nodes=new Map(),actions=[],renders=0,guard,registered;
let committed={enabled:true,minimumReward:300000,minFF:1,maxFF:3,maxBattleStats:0,tornCallsPerMinute:20,ffBatchesPerMinute:5,statusFilter:'hide-hospital',scanFullList:false,includeUnknownEstimates:false,includeAbroad:false};
const snapshot=(settings=committed)=>({settings:structuredClone(settings),runtime:{candidates:[],scannedRows:0},active:true,configured:true});
let nextScan=null,scanRequests=0;const saves=[],timers=new Map(),pageEvents=new Map();let timerId=0;
let resetRequests=0,statusReads=0;
const api={core:{storage:{get:async()=>({}),set:async()=>{}},format:{escapeHtml:value=>String(value??''),errorMessage:e=>e.message},messaging:{async send(type,payload){
  if(type==='bounties.settings.save'){const pending=deferred();saves.push({...pending,payload});return pending.promise;}
  if(type==='bounties.scan.batch'){scanRequests++;return nextScan.promise;}
  if(type==='bounties.scan.reset')resetRequests++;
  if(type==='bounties.status')statusReads++;
  return snapshot();
}}},modules:{register(value){registered=value;}},define(group,key,value){(this[group]??={})[key]=value;}};
const ui={getContentElement:()=>content,setTitle(){},setModuleStyles(){},setSubtitle(){},setStatus(text){ui.status=text;},setActions(value){actions=value;},setContentHtml(html){
  renders++;
  for(const node of nodes.values())node.isConnected=false;
  nodes=new Map();form.controls=[];
  if(html.includes('class="bounty-settings"')){
    for(const match of html.matchAll(/<input\b([^>]+)>/g)){
      const attrs=match[1],id=attrs.match(/\bid="([^"]+)"/)?.[1];if(!id)continue;
      const node=new HTMLInputElement(id,attrs.match(/\btype="([^"]+)"/)?.[1]||'text',attrs.match(/\bvalue="([^"]*)"/)?.[1]||'');
      node.checked=/\bchecked\b/.test(attrs);node.parentElement=form;nodes.set(id,node);form.controls.push(node);
    }
    for(const match of html.matchAll(/<select id="([^"]+)">([\s\S]*?)<\/select>/g)){
      const options=[...match[2].matchAll(/<option value="([^"]+)"([^>]*)>/g)];
      const node=new HTMLSelectElement(match[1],(options.find(x=>/selected/.test(x[2]))||options[0])[1]);
      node.parentElement=form;nodes.set(node.id,node);form.controls.push(node);
    }
    for(const match of html.matchAll(/<button id="(bounty-save|bounty-restart|bounty-retry)"[^>]*>/g)){const node=new Element('BUTTON');node.id=match[1];nodes.set(node.id,node);}
  }
  for(const id of ['bounty-results','bounty-scanned','bounty-total','bounty-count','bounty-disabled','bounty-configure','bounty-error','bounty-autosave-state']){const node=new Element();node.id=id;nodes.set(id,node);}
  shadow.controls=content.controls=form.controls;
  guard?.restore();
}};
const sandbox=vm.createContext({SLINK_EXTENSION:api,Element,HTMLInputElement,HTMLSelectElement,document,console,URL,Date,
  MutationObserver:class{observe(){}disconnect(){}},queueMicrotask,
  setTimeout:(callback,delay)=>{const id=++timerId;timers.set(id,{callback,delay});return id;},clearTimeout:id=>timers.delete(id),setInterval:()=>1,clearInterval(){},
  addEventListener:(type,callback)=>pageEvents.set(type,callback),removeEventListener:type=>pageEvents.delete(type)});
vm.runInContext(read('src/core/form-state.js'),sandbox);
guard=api.core.formState.protect(shadow);
vm.runInContext(read('src/modules/bounties.js'),sandbox);
const lifecycle=await registered.start({ui,signal:{aborted:false},presentation:'dashboard'});
const settingsAction=()=>actions.find(action=>action.id==='settings').onClick();
await settingsAction();
const edit=(id,value,change=true)=>{const node=nodes.get(id);if(node.type==='checkbox')node.checked=value;else node.value=String(value);shadow.emit('input',node);content.emit('input',node);if(change){shadow.emit('change',node);content.emit('change',node);}return node;};
const save=()=>nodes.get('bounty-save').click();

const settle=async()=>{for(let i=0;i<24;i++)await Promise.resolve();};
const ack=(request,patch={})=>{committed={...committed,...patch};const response=snapshot();if(request.payload.deferScanRestart)delete response.runtime;request.resolve(response);};
const runDebounce=()=>{for(const [id,timer]of [...timers])if(timer.delay===600){timers.delete(id);timer.callback();}};
const status=()=>nodes.get('bounty-autosave-state').textContent;
const originalMinimum=nodes.get('bounty-minimum');

edit('bounty-full-list',true);assert.equal(saves.length,1);
assert.deepEqual(Object.keys(saves[0].payload).sort(),['deferScanRestart','scanFullList']);
ack(saves[0],{scanFullList:true});await settle();assert.equal(status(),'Saved');
for(const value of ['5','50','500000'])edit('bounty-minimum',value,false);
assert.equal(saves.length,1,'Typing is debounced, not one storage write per keystroke');
assert.equal([...timers.values()].filter(timer=>timer.delay===600).length,1);
runDebounce();assert.equal(saves.length,2);const minimumSave=saves.at(-1);
assert.equal(minimumSave.payload.minimumReward,'500000');assert.equal(minimumSave.payload.maxFF,undefined);
edit('bounty-minimum',750000,false);edit('bounty-ff-rate',999);
ack(saves.at(-1),{minimumReward:500000,ffBatchesPerMinute:20});await settle();
minimumSave.resolve(snapshot({...committed,ffBatchesPerMinute:5}));await settle();
assert.equal(nodes.get('bounty-minimum').value,'750000','Newer typing survives an older acknowledgement');
assert.equal(nodes.get('bounty-ff-rate').value,'20','Out-of-order responses cannot roll back another confirmed field');
runDebounce();ack(saves.at(-1),{minimumReward:750000});await settle();
assert.equal(status(),'Saved');assert.equal(scanRequests,0,'Autosave must not start a scan');
edit('bounty-unknown',true);const on=saves.at(-1);
edit('bounty-unknown',false);const off=saves.at(-1);
edit('bounty-unknown',true);const onAgain=saves.at(-1);
ack(onAgain,{includeUnknownEstimates:true});await settle();
off.resolve(snapshot({...committed,includeUnknownEstimates:false}));on.resolve(snapshot());await settle();
assert.equal(nodes.get('bounty-unknown').checked,true,'Rapid toggles must keep the latest confirmed choice');
edit('bounty-min-ff',2.5);saves.at(-1).resolve(snapshot({...committed,minFF:null}));await settle();
assert.match(status(),/invalid value/);assert.equal(nodes.get('bounty-min-ff').value,'2.5','An invalid acknowledgement must not release or clear the draft');
await nodes.get('bounty-retry').click();ack(saves.at(-1),{minFF:2.5});await settle();assert.equal(status(),'Saved');

const beforeInvalid=saves.length;edit('bounty-max-bs','',false);runDebounce();
assert.equal(saves.length,beforeInvalid);assert.match(status(),/valid number/);
await settingsAction();assert(nodes.has('bounty-save'),'Invalid unsaved input must not be silently discarded on Close');
edit('bounty-max-bs',400);saves.at(-1).reject(Error('write failed'));await settle();
assert.match(status(),/Save failed/);assert.equal(nodes.get('bounty-max-bs').value,'400');assert.equal(nodes.get('bounty-retry').hidden,false);
await nodes.get('bounty-retry').click();ack(saves.at(-1),{maxBattleStats:400});await settle();assert.equal(status(),'Saved');

view.hidden=false;const beforePreview=statusReads;
edit('bounty-abroad',true);const abroad=saves.at(-1);edit('bounty-full-list',false);const fullList=saves.at(-1);
ack(abroad,{includeAbroad:true});ack(fullList,{scanFullList:false});await settle();
assert.equal([...timers.values()].filter(row=>row.delay===250).length,1,'Coalesce result refreshes after preference writes settle');
edit('bounty-ff-rate',11,false);
let preview=[...timers].find(([,row])=>row.delay===250);timers.delete(preview[0]);preview[1].callback();await settle();
assert.equal(statusReads,beforePreview,'Do not perform a heavy result read while typing is pending');
runDebounce();ack(saves.at(-1),{ffBatchesPerMinute:11});await settle();
preview=[...timers].find(([,row])=>row.delay===250);assert(preview);timers.delete(preview[0]);preview[1].callback();await settle();
assert.equal(statusReads,beforePreview+1);assert.equal(scanRequests,0,'Result refresh is local, not a Torn scan');view.hidden=true;

// Credential inputs are deliberately excluded from preference autosave.
const beforeKeys=saves.length;edit('bounty-torn-key','typed-secret');runDebounce();assert.equal(saves.length,beforeKeys);
let pending=save();await save();assert.equal(saves.length,beforeKeys+1,'Duplicate credential Save is blocked');
assert.deepEqual(Object.keys(saves.at(-1).payload),['tornKey']);
saves.at(-1).reject(Error('key write failed'));await pending;assert.equal(nodes.get('bounty-torn-key').value,'typed-secret');
pending=save();edit('bounty-torn-key','newer-secret');ack(saves.at(-1),{hasTornKey:true,tornKeySource:'Bounties'});await pending;
assert.equal(nodes.get('bounty-torn-key').value,'newer-secret','An old key acknowledgement cannot clear newer typing');
pending=save();ack(saves.at(-1));await pending;assert.equal(nodes.get('bounty-torn-key').value,'');

nextScan=deferred();const oldScan=actions.find(action=>action.id==='refresh').onClick();await settle();assert.equal(scanRequests,1);
edit('bounty-status-filter','all');ack(saves.at(-1),{statusFilter:'all'});await settle();
nextScan.resolve(snapshot({...committed,statusFilter:'hide-hospital'}));await oldScan;
assert.equal(nodes.get('bounty-status-filter').value,'all');assert.equal(nodes.get('bounty-minimum'),originalMinimum);
assert.equal(renders,2,'Background updates/autosaves must not rebuild the open editor');

// A normal scheduled cycle must wait for autosave and then remain scheduled,
// without resetting the crawl or turning each edit into a network request.
const fireScan=()=>{const timer=[...timers].find(([,row])=>row.delay===1000);assert(timer,'Missing scheduled scan');timers.delete(timer[0]);timer[1].callback();};
edit('bounty-ff-rate',10,false);fireScan();assert.equal(scanRequests,1);
runDebounce();ack(saves.at(-1),{ffBatchesPerMinute:10});await settle();assert.equal(scanRequests,1);
nextScan=deferred();fireScan();await settle();assert.equal(scanRequests,2);
nextScan.resolve(snapshot());await settle();assert.equal(resetRequests,0,'Autosave must not call Restart scan');

await settingsAction();await settingsAction();assert.equal(nodes.get('bounty-minimum').value,'750000');
edit('bounty-minimum',900000,false);const beforeHide=saves.length;
pageEvents.get('pagehide')();assert.equal(saves.length,beforeHide+1,'Navigation submits the debounced draft');
const stopping=lifecycle.stop(),stoppedRenders=renders;
assert.equal(saves.length,beforeHide+1,'Stop coalesces the already pending navigation save');
ack(saves.at(-1),{minimumReward:900000});await stopping;assert.equal(renders,stoppedRenders);
const resumed=await registered.start({ui,signal:{aborted:false},presentation:'dashboard'});
assert.equal(nodes.get('bounty-minimum').value,'900000');
edit('bounty-max-bs','',false);const beforeInvalidStop=saves.length;await resumed.stop();
const recovered=await registered.start({ui,signal:{aborted:false},presentation:'dashboard'});await settle();
assert.equal(nodes.get('bounty-max-bs').value,'');assert.match(status(),/valid number/);
assert.equal(saves.length,beforeInvalidStop,'Restoring an incomplete local draft must not write a default');
await recovered.stop();guard.stop();
console.log('Bounties autosave: debounce, validation, per-field patches, failed/retried and newer drafts, explicit credentials, stale replies, stable controls, navigation flush and stop/resume passed.');
