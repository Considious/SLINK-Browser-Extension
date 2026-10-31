import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const read=name=>fs.readFileSync(new URL('../'+name,import.meta.url),'utf8');
const api={core:{},define(group,key,value){this[group][key]=value;}};
let copied='',fallback=false,removed=0,restored=0,selection;
const focus={isConnected:true,selectionStart:2,selectionEnd:4,selectionDirection:'forward',focus:()=>{restored++;},setSelectionRange:(...args)=>{selection=args;}};
const context=vm.createContext({SLINK_EXTENSION:api,navigator:{clipboard:{writeText:async text=>{copied=text;}}},document:{activeElement:focus,body:{append(){}},createElement:()=>({style:{},select(){},remove(){removed++;}}),execCommand:()=>fallback}});
vm.runInContext(read('src/core/clipboard.js'),context);
assert.equal(await api.core.clipboard.copyText('Reminder'),true);assert.equal(copied,'Reminder');
context.navigator.clipboard.writeText=async()=>{throw Error('blocked');};fallback=true;
assert.equal(await api.core.clipboard.copyText('Fallback'),true);assert.equal(removed,1);assert.equal(restored,1);assert.deepEqual(selection,[2,4,'forward']);
fallback=false;assert.equal(await api.core.clipboard.copyText('Manual copy needed'),false);assert.equal(removed,2);assert.equal(await api.core.clipboard.copyText(''),false);

// Execute the production private-chat flow; Send must not fill/overwrite a draft.
let module,sendCount=0,historyClicks=0;
class Textarea{constructor(){this._value='';}get value(){return this._value;}set value(value){this._value=value;}dispatchEvent(){}focus(){}}
const textarea=new Textarea(),send={disabled:false,getAttribute:()=>null,isSend:true,click(){sendCount++;}},history={disabled:false,getAttribute:()=>null,isSend:false,click(){historyClicks++;}};
const panel={querySelectorAll:selector=>selector==='button[type="button"]'?[history,send]:[{textContent:'Employee'}],querySelector:()=>textarea};
const chatApi={core:{company:{reminderText:row=>'Rehab '+row.addictionPenalty},factionChat:{isSendButton:button=>button.isSend}},modules:{register:definition=>{module=definition;}}};
const chat=vm.createContext({SLINK_EXTENSION:chatApi,document:{querySelectorAll:()=>[panel]},HTMLTextAreaElement:Textarea,Event:class{},WeakMap});
const company=read('src/modules/company.js');
const numeric=vm.createContext({});vm.runInContext(company.slice(company.indexOf('  function number('),company.indexOf('  function relativeTime(')),numeric);
assert.equal(numeric.number(null),'Unavailable');assert.equal(numeric.number(undefined),'Unavailable');assert.equal(numeric.number(0),'0');
vm.runInContext(company.replace("  SLINK.modules.register({","  global.testFill=fillPrivateChat;\n  SLINK.modules.register({"),chat); // Export the actual lexical function for this fixture only.
chat.global=chat; // The module IIFE receives globalThis, so expose on the context.
const employee={id:42,name:'Employee',addictionPenalty:12};
assert.throws(()=>chat.testFill(employee,true,9),/Fill chat first/);assert.equal(textarea.value,'');assert.equal(sendCount,0);
chat.testFill(employee,false,9);assert.equal(textarea.value,'Rehab 12');textarea.value='My own edited draft';
assert.throws(()=>chat.testFill(employee,true,9),/edited draft/);assert.equal(textarea.value,'My own edited draft');assert.equal(sendCount,0);
chat.testFill(employee,false,9);assert.throws(()=>chat.testFill(employee,true,10),/Fill chat first/);assert.equal(sendCount,0);
chat.testFill(employee,false,9);chat.testFill(employee,true,9);assert.equal(sendCount,1);assert.equal(historyClicks,0);
assert.throws(()=>chat.testFill(employee,true,9),/Fill chat first/);assert.equal(sendCount,1,'Sending consumes the explicit primed reminder');

// The real Officer copy callback checks separate armory/OC access and captures a report.
vm.runInContext(read('src/core/faction-officers.js'),context);
const core=api.core.factionOfficers;
assert.equal(core.restockMessage('Restock Needed:',[{name:'Xanax',current:1200,target:5000}]),'Restock Needed:\nXanax 1200/5000');
assert.equal(core.missingCrimeMessage([{userName:'Tester',userId:42,itemName:'Zip Ties',crimeName:'Crime'}]),'OC Items Missing:\nTester [42] — Zip Ties for Crime');
let handler,reports=[],enabled=true;
const fallbackNode={hidden:true},manual={value:''};
const officer=vm.createContext({context:{listen:(_root,_type,fn)=>{handler=fn;}},root:{},allowed:()=>enabled,current:{access:{armory:true,oc:false},runtime:{armoryShortages:[{name:'Xanax',current:1200,target:5000}],missingCrimeItems:[{userName:'Private',userId:43,itemName:'Item',crimeName:'OC'}]}},
 CORE:core,copying:new Set(),notice:'',slot:()=>({querySelector:selector=>selector==='[data-fo-copy-fallback]'?fallbackNode:manual}),render(){},
 SLINK:{core:{clipboard:{copyText:async text=>{reports.push(text);return false;}},format:{errorMessage:error=>error.message}}}});
const source=read('src/modules/faction-officers.js');vm.runInContext(source.slice(source.indexOf("      context.listen(root,'click',async event=>{"),source.indexOf('      await load(true);')),officer);
const click=action=>({target:{closest:()=>({dataset:{foAction:action},disabled:false})}});
await handler(click('copy-missing'));assert.equal(reports.length,0,'Armory grant must not copy OC-only data');
await handler(click('copy-armory'));assert.equal(reports[0],'Restock Needed:\nXanax 1200/5000');assert.equal(fallbackNode.hidden,false);assert.equal(manual.value,reports[0]);
officer.current.access.oc=true;await handler(click('copy-missing'));assert.match(reports[1],/Private \[43\]/);
officer.current.runtime.armoryError='offline';await handler(click('copy-armory'));assert.match(reports[2],/^Last available results; latest check failed/);
enabled=false;await handler(click('copy-armory'));assert.equal(reports.length,3);
console.log('Company explicit private-chat priming, edited-draft safety, shared clipboard/focus fallback and Officer exact-access report copying passed.');
