import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';

const code = fs.readFileSync(new URL('../src/core/museum.js', import.meta.url), 'utf8');
const sandbox = { console, globalThis:null, SLINK_EXTENSION:{ core:{}, define(namespace,name,value){ this[namespace] ||= {}; this[namespace][name] = value; } } };
sandbox.globalThis = sandbox;
vm.runInNewContext(code, sandbox);
const museum = sandbox.SLINK_EXTENSION.core.museum;

const catalog = museum.SETS.flatMap((set, setIndex) => set.items.map((entry, itemIndex) => ({
  id:(setIndex + 1) * 100 + itemIndex,
  name:entry.name,
  type:set.travel ? 'Plushie' : 'Artifact',
  marketPrice:1000 + itemIndex
})));
const inventoryItems = museum.SETS.flatMap((set, setIndex) => set.items.map((entry, itemIndex) => ({
  id:(setIndex + 1) * 100 + itemIndex,
  name:entry.name,
  amount:entry.amount
})));
const full = museum.buildStatus({ inventory:{ items:inventoryItems } }, catalog);
assert.equal(full.summary.completed, museum.SETS.length);
assert.ok(full.summary.redeemablePoints > 0);

const missing = museum.buildStatus({ inventory:{ items:inventoryItems.filter(row => row.name !== 'Jaguar Plushie') } }, catalog);
const plushies = missing.sets.find(set => set.id === 'plushies');
assert.equal(plushies.complete, false);
assert.equal(plushies.items.find(item => item.name === 'Jaguar Plushie').needed, 1);
assert.equal(plushies.items.find(item => item.name === 'Jaguar Plushie').itemId, 100);

assert.equal(museum.canonicalName('Quran Script : Ali'), 'Companion Script : Ali');
assert.equal(museum.setById('flowers').travel, true);
console.log('museum tests passed');

// Actual Museum action boundary: capture before authorization, retain the
// existing Market owner/permissions, and acknowledge the specific stored watch.
const marketCalls=[];let authorizationCalls=0;
sandbox.SLINK_EXTENSION.services={permissionAccess:{ensureSession:async()=>{authorizationCalls++;}},market:{routes:{'market.watch.save':async payload=>{marketCalls.push(payload);return {settings:{watches:[{marketType:'item',itemId:payload.itemId,maxPrice:payload.maxPrice}]}};}}},abroadStocks:{addItemWatches:async names=>({added:names.length,matched:names.length})}};
vm.runInNewContext(fs.readFileSync(new URL('../src/background/museum-service.js',import.meta.url),'utf8'),sandbox);
const museumRoutes=sandbox.SLINK_EXTENSION.services.museum.routes;
const receipt=await museumRoutes['museum.market.add']({itemId:100,maxPrice:1234.9});
assert.equal(receipt.ok,true);assert.equal(receipt.itemId,100);assert.equal(receipt.maxPrice,1234);
const callsBeforeInvalid=marketCalls.length,authBeforeInvalid=authorizationCalls;
for(const maxPrice of ['',0,-1,Infinity,NaN])await assert.rejects(()=>museumRoutes['museum.market.add']({itemId:100,maxPrice}),/positive maximum price/);
assert.equal(marketCalls.length,callsBeforeInvalid);assert.equal(authorizationCalls,authBeforeInvalid);
let finishAuthorization;
sandbox.SLINK_EXTENSION.services.permissionAccess.ensureSession=()=>new Promise(resolve=>{finishAuthorization=resolve;});
const pendingPayload={itemId:101,maxPrice:4567,priority:'normal'};
const pendingWatch=museumRoutes['museum.market.add'](pendingPayload);
pendingPayload.itemId=999;pendingPayload.maxPrice=1;pendingPayload.priority='high';finishAuthorization();await pendingWatch;
assert.equal(marketCalls.at(-1).itemId,101);assert.equal(marketCalls.at(-1).maxPrice,4567);assert.equal(marketCalls.at(-1).priority,'normal');
sandbox.SLINK_EXTENSION.services.permissionAccess.ensureSession=async()=>{};
sandbox.SLINK_EXTENSION.services.market.routes['market.watch.save']=async()=>({settings:{watches:[{marketType:'item',itemId:101,maxPrice:99}]}});
await assert.rejects(()=>museumRoutes['museum.market.add']({itemId:101,maxPrice:100}),/did not confirm/);
sandbox.SLINK_EXTENSION.services.market.routes['market.watch.save']=async()=>{throw Error('synthetic Market slot limit');};
await assert.rejects(()=>museumRoutes['museum.market.add']({itemId:101,maxPrice:100}),/Market slot limit/);
sandbox.SLINK_EXTENSION.services.permissionAccess.ensureSession=async()=>{throw Error('Museum permission denied');};
await assert.rejects(()=>museumRoutes['museum.market.add']({itemId:101,maxPrice:100}),/Museum permission denied/);
sandbox.SLINK_EXTENSION.services.permissionAccess.ensureSession=async()=>{};
assert.equal((await museumRoutes['museum.abroad.track']({setId:'plushies'})).added,museum.setById('plushies').items.length);
await assert.rejects(()=>museumRoutes['museum.abroad.track']({setId:'senet'}),/does not use Abroad/);
console.log('Museum service: captured/validated action intent, specific watch receipts, permission/slot failures and explicit Abroad delegation passed.');

const moduleSource=fs.readFileSync(new URL('../src/modules/museums.js',import.meta.url),'utf8');
const loadStart=moduleSource.indexOf('      async function load('),loadEnd=moduleSource.indexOf("      context.listen(root, 'click'",loadStart);
assert(loadStart>=0&&loadEnd>loadStart);
const reads=[];
const controller={busy:false,stopped:false,notice:'',context:{signal:{aborted:false}},renders:0,statusUpdates:0,
 SLINK:{core:{messaging:{send(type,payload){let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});reads.push({type,payload,resolve,reject});return promise;}},format:{errorMessage:error=>error.message}}},
 ui:{setStatus(){controller.statusUpdates++;}},render(){if(!controller.stopped)controller.renders++;}};
vm.createContext(controller);vm.runInContext(moduleSource.slice(loadStart,loadEnd),controller);
const pendingRead=controller.load(true);await controller.load(true);assert.equal(reads.length,1);
reads[0].resolve({summary:{completed:0,total:1},sets:[]});await pendingRead;assert.equal(controller.busy,false);
const failedRead=controller.load(true);reads.at(-1).reject(Error('synthetic inventory failure'));await failedRead;
assert.equal(controller.notice,'synthetic inventory failure');assert.equal(controller.busy,false);
const lateRead=controller.load(true);controller.stopped=true;const oldRenders=controller.renders,oldUpdates=controller.statusUpdates;
reads.at(-1).resolve({summary:{completed:1,total:1},sets:[]});await lateRead;
assert.equal(controller.renders,oldRenders);assert.equal(controller.statusUpdates,oldUpdates);
console.log('Museum controller: duplicate refresh guard, failed-read recovery and stopped-response isolation passed.');
