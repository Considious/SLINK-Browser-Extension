import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const read=file=>fs.readFileSync(new URL('../'+file,import.meta.url),'utf8');
const deferred=()=>{let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return {promise,resolve,reject};};
const document={activeElement:null};
class Element {
  constructor(tag='DIV'){this.tagName=tag;this.dataset={};this.controls=[];this.listeners={};this.isConnected=true;this.hidden=false;}
  matches(selector){if(selector==='[data-ui-autosave="true"]'||selector==='[contenteditable="true"]')return false;return this.tagName==='INPUT'&&/input/.test(selector);}
  closest(selector){if(selector==='.module-view'||selector.includes('data-slink-module-id'))return view;if(selector.includes('data-ui-explicit-commit'))return content;if(selector.includes('button')&&this.tagName==='BUTTON')return this;return this.parentElement||null;}
  querySelectorAll(selector){if(selector.includes('data-mugging-save'))return [];return this.controls.filter(node=>node.matches(selector));}
  querySelector(selector){return selector==='.mugging-controls'?form:nodes.get(selector.slice(1))||null;}
  contains(node){return node===this||this.controls.includes(node);}
  getRootNode(){return shadow;}
  addEventListener(type,fn){(this.listeners[type]??=[]).push(fn);}
  removeEventListener(type,fn){this.listeners[type]=(this.listeners[type]||[]).filter(item=>item!==fn);}
  emit(type,target=this){return Promise.all((this.listeners[type]||[]).map(fn=>fn({target})));}
  click(){void shadow.emit('click',this);return this.emit('click');}
  focus(){shadow.activeElement=document.activeElement=this;}
  setSelectionRange(start,end,direction){this.selectionStart=start;this.selectionEnd=end;this.selectionDirection=direction;}
}
class HTMLInputElement extends Element {constructor(id,type,value){super('INPUT');this.id=id;this.type=type;this.value=value;this.checked=false;}}
class HTMLSelectElement extends Element {}
const shadow=new Element(),content=new Element(),form=new Element(),view=new Element();
view.dataset.slinkModuleId='mugging';view.hidden=true;
let nodes=new Map(),actions=[],renders=0,guard,definition,html='';
const observers=[],saves=[],assignments=[],statusReplies=[];
let contributions=0;
let committed={enabled:true,minFairFight:1,maxFairFight:3,limit:50};
let cached={targets:[],userBattleStats:600000};
const api={core:{format:{escapeHtml:value=>String(value??''),shortNumber:value=>'n'+value,errorMessage:error=>error.message},storage:{get:async key=>structuredClone(key==='mugging.settings.v1'?committed:cached),set:async()=>{}},messaging:{async send(type,payload){
  if(type==='mugging.settings.save'){const reply=deferred();saves.push({payload,...reply});return reply.promise;}
  if(type==='mugging.assignments.refresh'){const reply=deferred();assignments.push({payload,...reply});return reply.promise;}
  if(type==='mugging.status')return statusReplies.length?statusReplies.shift().promise:cached;
  if(type==='mugging.contribution.run'){contributions++;return {};}
  return {};
}}},modules:{register(value){definition=value;}},define(group,key,value){(this[group]??={})[key]=value;}};
const ui={getContentElement:()=>content,setTitle(){},setModuleStyles(){},setSubtitle(){},setStatus(value){ui.status=value;},setActions(value){actions=value;},setContentHtml(value){
  html=value;renders++;for(const node of nodes.values())node.isConnected=false;nodes=new Map();form.controls=[];
  for(const match of html.matchAll(/<input\b([^>]+)>/g)){
    const attrs=match[1],id=attrs.match(/\bid="([^"]+)"/)?.[1];if(!id)continue;
    const node=new HTMLInputElement(id,attrs.match(/\btype="([^"]+)"/)?.[1]||'text',attrs.match(/\bvalue="([^"]*)"/)?.[1]||'');
    node.checked=/\bchecked\b/.test(attrs);node.parentElement=form;nodes.set(id,node);form.controls.push(node);
  }
  const button=new Element('BUTTON');button.id='mugging-find';nodes.set(button.id,button);
  for(const id of ['mugging-summary','mugging-targets','mugging-error','mugging-notice','mugging-sync','mugging-pool-note']){const node=new Element();node.id=id;nodes.set(id,node);}
  nodes.get('mugging-summary').innerHTML=html;
  shadow.controls=content.controls=form.controls;guard?.restore();
}};
const sandbox=vm.createContext({SLINK_EXTENSION:api,document,Element,HTMLInputElement,HTMLSelectElement,console,Date,queueMicrotask,
  MutationObserver:class{constructor(callback){this.callback=callback;observers.push(this);}observe(){}disconnect(){}},setTimeout:()=>1,clearTimeout(){}});
vm.runInContext(read('src/core/form-state.js'),sandbox);guard=api.core.formState.protect(shadow);
vm.runInContext(read('src/modules/mugging.js'),sandbox);
const lifecycle=await definition.start({ui,signal:{aborted:false},presentation:'dashboard'});
const originalMinimum=nodes.get('mugging-min-ff');
function edit(id,value,change=true){const node=nodes.get(id);if(node.type==='checkbox')node.checked=value;else node.value=String(value);void shadow.emit('input',node);return change?node.emit('change'):Promise.resolve();}
function ack(index,value){committed={...committed,...value};saves[index].resolve(structuredClone(committed));}
const settle=async()=>{for(let i=0;i<12;i++)await Promise.resolve();};

// Older acknowledgements must not undo newer fields or typing.
const first=edit('mugging-min-ff',999);assert.deepEqual(Object.keys(saves[0].payload),['minFairFight']);
edit('mugging-min-ff',2.1,false);
const second=edit('mugging-limit',999);
ack(1,{minFairFight:3,limit:100});await second;
assert.equal(nodes.get('mugging-limit').value,'100');assert.equal(nodes.get('mugging-min-ff').value,'2.1');
saves[0].resolve({enabled:true,minFairFight:3,maxFairFight:3,limit:50});await first;
assert.equal(nodes.get('mugging-limit').value,'100','An older ack cannot roll back a newer saved field');
assert.equal(nodes.get('mugging-min-ff').value,'2.1');
const failed=edit('mugging-min-ff',2.2);saves[2].reject(Error('write rejected'));await failed;
assert.equal(nodes.get('mugging-min-ff').value,'2.2');assert.match(ui.status,/write rejected/);
const retry=edit('mugging-min-ff',2.2);ack(3,{minFairFight:2.2});await retry;
assert.doesNotMatch(ui.status,/write rejected/);

// Toggle acknowledgements may also arrive out of order; never start optional
// contributor work for an already superseded enable action.
const off=edit('mugging-enabled',false),on=edit('mugging-enabled',true),offAgain=edit('mugging-enabled',false);
ack(6,{enabled:false});await offAgain;
saves[5].resolve({...committed,enabled:true});await on;
saves[4].resolve({...committed,enabled:false});await off;
assert.equal(nodes.get('mugging-enabled').checked,false);assert.equal(contributions,0);

const enabled=edit('mugging-enabled',true);ack(7,{enabled:true});await enabled;
assert.equal(contributions,1);
edit('mugging-limit',125,false);
let find=nodes.get('mugging-find').click();await nodes.get('mugging-find').click();
assert.equal(saves.length,9,'Pending Find clicks must not enqueue duplicate saves');
assert.deepEqual(Object.keys(saves[8].payload),['limit']);assert.equal(assignments.length,0,'Find waits for confirmed settings');
ack(8,{limit:100});await settle();
assert.equal(assignments.length,1);assert.equal(assignments[0].payload.limit,100);
const newerFilter=edit('mugging-max-ff',2.8);ack(9,{maxFairFight:2.8});await newerFilter;
assignments[0].resolve({targets:[],userBattleStats:1});await find;
assert(nodes.get('mugging-summary').innerHTML.includes('n600000'),'A response for old settings must not replace the current cache');

// A visibility-status response started before Find must not replace its newer
// own-stat/assignment snapshot when that old response eventually arrives.
const oldStatus=deferred();statusReplies.push(oldStatus);view.hidden=false;observers.at(-1).callback();
find=actions[0].onClick();await settle();assert.equal(assignments.length,2);
assignments[1].resolve({targets:[],userBattleStats:700000});await find;
oldStatus.resolve({targets:[],userBattleStats:500000});await settle();assert(nodes.get('mugging-summary').innerHTML.includes('n700000'));
assert.equal(renders,1,'Autosaves and cache refreshes must not rebuild the editor');
assert.equal(nodes.get('mugging-min-ff'),originalMinimum,'Preserve the actual editable DOM node, not just a restored value');

edit('mugging-limit',40,false);const failedFind=nodes.get('mugging-find').click();
const unrelatedEdit=edit('mugging-max-ff',2.7);ack(11,{maxFairFight:2.7});await unrelatedEdit;
saves[10].reject(Error('Find settings failed'));await failedFind;
assert.equal(assignments.length,2,'Do not request targets with settings that failed to save');
assert.equal(nodes.get('mugging-limit').value,'40');assert.match(ui.status,/Find settings failed/);
const late=edit('mugging-limit',25);lifecycle.stop();const stoppedRenders=renders;
ack(12,{limit:25});await late;
assert.equal(renders,stoppedRenders,'No late save redraw after module stop');
guard.stop();
console.log('Mugging autosave: per-field patches, failed/newer drafts, out-of-order replies, toggles, normalized Find, stale cache fencing and stopped-instance isolation passed.');
