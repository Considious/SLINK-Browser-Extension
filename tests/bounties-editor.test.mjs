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
  removeEventListener(){}
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
let committed={enabled:true,minimumReward:300000,minFF:1,maxFF:3,maxBattleStats:0,tornCallsPerMinute:20,ffBatchesPerMinute:5,statusFilter:'hide-hospital'};
const snapshot=(settings=committed)=>({settings:structuredClone(settings),runtime:{candidates:[],scannedRows:0},active:true,configured:true});
let nextSave=null,nextScan=null,saves=0,scanRequests=0,lastPayload;
const api={core:{storage:{get:async()=>({}),set:async()=>{}},format:{escapeHtml:value=>String(value??''),errorMessage:e=>e.message},messaging:{async send(type,payload){
  if(type==='bounties.settings.save'){saves++;lastPayload=payload;return nextSave.promise;}
  if(type==='bounties.scan.batch'){scanRequests++;return nextScan.promise;}
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
    for(const match of html.matchAll(/<button id="(bounty-save|bounty-restart)"[^>]*>/g)){const node=new Element('BUTTON');node.id=match[1];nodes.set(node.id,node);}
  }
  shadow.controls=content.controls=form.controls;
  guard?.restore();
}};
const sandbox=vm.createContext({SLINK_EXTENSION:api,Element,HTMLInputElement,HTMLSelectElement,document,console,URL,Date,
  MutationObserver:class{observe(){}disconnect(){}},queueMicrotask,
  setTimeout:()=>1,clearTimeout(){},setInterval:()=>1,clearInterval(){}});
vm.runInContext(read('src/core/form-state.js'),sandbox);
guard=api.core.formState.protect(shadow);
vm.runInContext(read('src/modules/bounties.js'),sandbox);
const lifecycle=await registered.start({ui,signal:{aborted:false},presentation:'dashboard'});
const settingsAction=()=>actions.find(action=>action.id==='settings').onClick();
settingsAction();
const edit=(id,value)=>{const node=nodes.get(id);if(node.type==='checkbox')node.checked=value;else node.value=String(value);shadow.emit('input',node);shadow.emit('change',node);return node;};
const save=()=>nodes.get('bounty-save').click();

// Failed acknowledgements must not clear fields, including typed credentials.
edit('bounty-minimum',500000);edit('bounty-full-list',true);edit('bounty-torn-key','typed-secret');
nextSave=deferred();let pending=save();
assert.equal(lastPayload.enabled,undefined,'An unchanged checkbox must not overwrite another window\'s setting');
assert.equal(lastPayload.maxFF,undefined,'Send edited fields, not the entire stale form');
assert.equal(lastPayload.minimumReward,'500000');
await save();assert.equal(saves,1,'A second Save while awaiting acknowledgement must not submit twice');
assert.equal(nodes.get('bounty-minimum').value,'500000');
nextSave.reject(Error('write failed'));await pending;
assert.equal(nodes.get('bounty-minimum').value,'500000');assert.equal(nodes.get('bounty-full-list').checked,true);
assert.equal(nodes.get('bounty-torn-key').value,'typed-secret');assert.match(ui.status,/write failed/);

// Start a scan with old settings, then acknowledge a settings save while newer
// typing is present. Only the submitted revisions may be released.
nextScan=deferred();const oldScan=actions.find(action=>action.id==='refresh').onClick();
assert.equal(scanRequests,1);
nextSave=deferred();pending=save();
edit('bounty-minimum',750000);edit('bounty-ff-rate',999);
committed={...committed,minimumReward:500000,scanFullList:true};
nextSave.resolve(snapshot());await pending;
assert.equal(nodes.get('bounty-minimum').value,'750000','Typing after Save must remain unsaved');
assert.equal(nodes.get('bounty-ff-rate').value,'999');
assert.equal(nodes.get('bounty-full-list').checked,true);
assert.equal(nodes.get('bounty-torn-key').value,'','Saved secret must leave the editor, not remain in a draft');
assert.match(ui.status,/Newer edits are still unsaved/);
nextScan.resolve(snapshot({...committed,minimumReward:300000,scanFullList:false}));await oldScan;
assert.equal(nodes.get('bounty-full-list').checked,true,'A late pre-save scan must not undo acknowledged settings');
assert.equal(nodes.get('bounty-minimum').value,'750000');

// A clean acknowledgement applies normalization and keeps the editor open.
nextSave=deferred();pending=save();
assert.equal(lastPayload.ffBatchesPerMinute,'999');
committed={...committed,minimumReward:750000,ffBatchesPerMinute:20};
nextSave.resolve(snapshot());await pending;
assert.equal(nodes.get('bounty-ff-rate').value,'20');assert(nodes.has('bounty-save'));
assert.match(ui.status,/Settings saved/);

// Explicit close cancels the draft, while stop/resume retains the open editor.
edit('bounty-minimum',999999);settingsAction();settingsAction();
assert.equal(nodes.get('bounty-minimum').value,'750000');
edit('bounty-minimum',888888);lifecycle.stop();
const resumed=await registered.start({ui,signal:{aborted:false},presentation:'dashboard'});
assert(nodes.has('bounty-save'));assert.equal(nodes.get('bounty-minimum').value,'888888');
nextSave=deferred();pending=save();resumed.stop();const stoppedRenders=renders;
nextSave.resolve(snapshot());await pending;
assert.equal(renders,stoppedRenders,'A completed save must not redraw a stopped module');
guard.stop();
console.log('Bounties editor: failed saves, duplicate clicks, newer drafts, normalization, late scan replies, cancel and retained lifecycle passed.');
