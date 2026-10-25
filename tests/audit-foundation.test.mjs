import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const read=path=>fs.readFileSync(new URL('../'+path,import.meta.url),'utf8');
const api={core:{},define(group,name,value){this[group]||={};this[group][name]=value;}};
const registered=vm.createContext({SLINK_EXTENSION:api,console,URL,chrome:{},crypto:{randomUUID:()=> 'fixture'}});
for(const [,src] of read('src/dashboard/dashboard.html').matchAll(/<script src="([^"]+)"/g)){
  if(src==='dashboard.js')continue;
  const path=new URL(src,new URL('../src/dashboard/dashboard.html',import.meta.url));
  vm.runInContext(fs.readFileSync(path,'utf8'),registered,{filename:src});
}
const museum=api.modules.list().find(module=>module.id==='museums');
const officer=api.modules.list().find(module=>module.id==='faction-officers');
assert.ok(museum&&officer,'Both QoL modules must register from the actual dashboard imports.');
for(const scope of ['slink.war.officer','slink.officer.armory','slink.officer.oc','admin.*'])assert.equal(api.modules.canAccess(officer,{scopes:[scope]}),true,scope);
assert.equal(api.modules.canAccess(officer,{scopes:[]}),false);
assert.equal(api.modules.canAccess(museum,{scopes:['slink.qol.museum']}),true);
assert.equal(api.modules.canAccess(museum,{scopes:[]}),false);

const dashboard=read('src/dashboard/dashboard.js');
const start=dashboard.indexOf('  async function startQualityModule(id)');
const end=dashboard.indexOf('  async function switchQuality(',start);
let stops=0,clears=0,opened='';
const denied=vm.createContext({SLINK:api,qualityInstances:new Map([['faction-officers',{stop:async()=>stops++}]]),qualityDefinition:()=>officer,system:{permissions:{scopes:[]}},qualityUi:()=>({getContentElement:()=>({replaceChildren(){clears++;}}),setStatus(){}})});
vm.runInContext(dashboard.slice(start,end),denied);
assert.equal(await denied.startQualityModule('faction-officers'),null);
assert.equal(stops,1);assert.equal(clears,1);assert.equal(denied.qualityInstances.size,0);
const uiStart=dashboard.indexOf('  function qualityUi(id)');
const uiEnd=dashboard.indexOf('  async function startQualityModule(',uiStart);
const adapter=vm.createContext({CSS:{escape:value=>value},document:{querySelector:()=>null},window:{open:url=>opened=url}});
vm.runInContext(dashboard.slice(uiStart,uiEnd),adapter);
adapter.qualityUi('faction-officers').navigateTo('war');
assert.equal(opened,'https://www.torn.com/factions.php?step=your#/tab=armoury');

// A failed individual write rejects its caller, but must not poison the queue.
let attempts=0;const storage=new Map();
api.core.storage={get:async(key,fallback)=>storage.get(key)||fallback,set:async(key,value)=>{if(++attempts===1)throw new Error('fixture write failure');storage.set(key,value);}};
vm.runInContext(read('src/core/player-intelligence.js'),registered);
vm.runInContext(read('src/background/player-intelligence-service.js'),registered);
const intelligence=api.services.playerIntelligence;
await assert.rejects(()=>intelligence.observe({playerId:123,state:'Okay',observedAt:100}),/fixture write failure/);
const record=await intelligence.observe({playerId:456,state:'Okay',observedAt:200});
assert.equal(record.playerId,456);assert.equal(attempts,2);
assert.equal((await intelligence.observeMany([{playerId:789,state:'Okay',observedAt:300}])).updated,1);
console.log('Audit foundation: actual dashboard imports, exact-grant permissions, revocation, navigation and queue recovery passed.');
