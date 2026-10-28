import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';

const code = fs.readFileSync(new URL('../src/core/company.js', import.meta.url), 'utf8');
const namespaces = { core:{} };
const sandbox = {
  console,
  globalThis:null,
  SLINK_EXTENSION:{
    define(namespace, name, value) {
      namespaces[namespace] ||= {};
      namespaces[namespace][name] = value;
      this[namespace] ||= {};
      this[namespace][name] = value;
    },
    core:namespaces.core
  }
};
sandbox.globalThis = sandbox;
vm.runInNewContext(code, sandbox);
const company = sandbox.SLINK_EXTENSION.core.company;

assert.equal(company.addictionPenalty({ effectiveness:{ addiction:-12 } }), 12);
assert.equal(company.addictionPenalty({ effectiveness:{ addiction:4 } }), 0);
assert.equal(company.addictionPenalty({}), null);

const snapshot = company.normalizeSnapshot(
  {
    job:{ type:'company', id:44, type_id:6, name:'Test Company', rating:10, position:'Director', days_in_company:90 },
    jobpoints:{ companies:[{ company:{ id:6, name:'Gun Shop' }, points:321 },{ company:{id:44,name:'Unrelated company type'},points:999 }] }
  },
  {
    profile:{ id:44, name:'Test Company', rating:10, director:{ id:7, name:'Owner' } },
    employees:[
      { id:7, name:'Owner', effectiveness:{ addiction:-2, working_stats:45, total:80 }, stats:{ manual_labor:100 } },
      { id:8, name:'Needs Rehab', effectiveness:{ addiction:-15, working_stats:20, total:60 }, stats:{ manual_labor:50 } }
    ]
  },
  7,
  1000
);
assert.equal(snapshot.director, true);
assert.equal(snapshot.company.jobPoints, 321);
assert.equal(snapshot.self.name, 'Owner');
assert.equal(snapshot.company.typeId,6,'Job points are keyed by CompanyTypeId, not the specific company ID');
const otherCompany=company.normalizeSnapshot({job:{type:'company',id:55,type_id:6},jobpoints:{companies:[{company:{id:6,name:'Gun Shop'},points:321}]}},{},7);
assert.equal(otherCompany.company.jobPoints,321,'Moving to another company of the same type must retain the same point balance');
assert.equal(company.normalizeSnapshot({job:{type:'company',id:44,type_id:7},jobpoints:{companies:[{company:{id:6},points:321}]}},{},7).company.jobPoints,null,'An unrelated company type must not supply the current point balance');

const alerts = company.buildAlerts(snapshot, { addictionThreshold:2, directorThreshold:10 });
assert.deepEqual(Array.from(alerts, alert => alert.id), ['company:addiction:self','company:addiction:8']);
assert.equal(alerts[1].reminder, 'Your addiction penalty is currently -15. Please rehab as soon as possible.');

const employeeSnapshot = company.normalizeSnapshot({}, { profile:{ director:{ id:7 } }, employees:[] }, 8);
assert.equal(employeeSnapshot.director, false);
assert.equal(company.buildAlerts(employeeSnapshot, {}).length, 0);
assert.equal(company.buildAlerts({...snapshot,self:null}, {directorThreshold:10})[0]?.id,'company:addiction:8','A missing director roster row must not suppress other employee alerts');

const ranked = company.rankTrainCandidates(snapshot.employees);
assert.equal(ranked[0].id, 8);
assert.equal(company.normalizeSettings({ addictionThreshold:0, directorThreshold:999, refreshMinutes:1 }).addictionThreshold, 1);
assert.equal(company.normalizeSettings({ addictionThreshold:0, directorThreshold:999, refreshMinutes:1 }).directorThreshold, 100);
assert.equal(company.normalizeSettings({ addictionThreshold:0, directorThreshold:999, refreshMinutes:1 }).refreshMinutes, 5);

console.log('company tests passed');

// Execute the real module controller. The reusable autosave/DOM layer has its
// own executable regression; this isolates Company response and layout policy.
const deferred=()=>{let resolve;const promise=new Promise(done=>{resolve=done;});return {promise,resolve};};
const elements=new Map();let editorWrites=0,mounts=0,stopCalls=0,options,definition,click,delayed=null;
for(const key of ['overview','editor','director','notice','save-state','retry','copy-fallback'])elements.set(`[data-company-${key}]`,{innerHTML:'',textContent:'',hidden:false,dataset:{}});
const directorList={children:[],contains:()=>false},rankCount={textContent:''},directorNode=elements.get('[data-company-director]');
directorNode.querySelector=selector=>selector==='[data-company-employees]'?directorList:rankCount;
directorNode.replaceChildren=()=>{directorNode.innerHTML='';};
const editor=elements.get('[data-company-editor]');let editorHtml='';
Object.defineProperty(editor,'innerHTML',{get:()=>editorHtml,set:value=>{editorHtml=value;editorWrites++;}});
const root={innerHTML:'',querySelector:selector=>elements.get(selector),querySelectorAll:()=>[]};
let confirmed={...company.DEFAULT_SETTINGS};let isDirector=true;
const response=()=>({settings:{...confirmed},snapshot:{company:{id:99,name:'Synthetic'},director:isDirector,self:null,employees:[]},fetchedAt:Date.now()});
const sent=[];
const moduleApi={core:{company,format:{errorMessage:error=>error.message},formState:{autosave:config=>{options=config;return {busy:false,mount(){mounts++;},retry:async()=>{},stop:async()=>{stopCalls++;}};}},messaging:{async send(type,payload){
 sent.push({type,payload});
 if(type==='company.settings.save'){confirmed=company.normalizeSettings({...confirmed,...payload.settings});return {settings:{...confirmed}};}
 if(delayed)return delayed.promise;
 return response();
}}},modules:{register:value=>{definition=value;}}};
vm.runInNewContext(fs.readFileSync(new URL('../src/modules/company.js',import.meta.url),'utf8'),{SLINK_EXTENSION:moduleApi,console,document:{activeElement:null}});
const lifecycle=await definition.start({presentation:'dashboard',signal:{aborted:false},ui:{getContentElement:()=>root,setModuleStyles(){},setStatus(){}},listen:(node,type,fn)=>{click=fn;}});
assert.equal(mounts,1);assert.equal(editorWrites,1);assert.match(editorHtml,/company-director-threshold/);assert.doesNotMatch(editorHtml,/Save alerts/);
assert.deepEqual(Object.values(options.fields),['addictionThreshold','directorThreshold']);
const beforeRefresh=response();delayed=deferred();
await click({target:{closest:selector=>selector==='[data-company-refresh]'?{}:null}});
const acknowledged=await options.save({addictionThreshold:25});
options.onCommit({addictionThreshold:acknowledged.settings.addictionThreshold});
delayed.resolve(beforeRefresh);delayed=null;await new Promise(resolve=>setImmediate(resolve));
assert.equal(options.read('addictionThreshold'),25,'Late full refresh cannot undo confirmed preference settings');
assert.equal(editorWrites,1,'Same-company refresh must not rebuild settings controls');
assert.equal(mounts,1);assert.equal(options.select(acknowledged).addictionThreshold,25);
options.onState({state:'failed'});assert.equal(elements.get('[data-company-retry]').hidden,false);
options.onState({state:'saved'});assert.equal(elements.get('[data-company-retry]').hidden,true);
isDirector=false;await click({target:{closest:selector=>selector==='[data-company-refresh]'?{}:null}});await new Promise(resolve=>setImmediate(resolve));
assert.doesNotMatch(editorHtml,/company-director-threshold/);assert.equal(elements.get('[data-company-director]').innerHTML,'');
assert.equal(editorWrites,2,'A genuine director-role change remounts only the editor layout');
await lifecycle.stop();assert.equal(stopCalls,1);
const afterStop=sent.length;await click({target:{closest:()=>({})}});assert.equal(sent.length,afterStop);
console.log('Company module: allowlisted autosave, acknowledged response fencing, stable layout, retry status, director loss and stopped actions passed.');
