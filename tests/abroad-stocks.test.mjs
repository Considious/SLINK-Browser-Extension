import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = fs.readFileSync(path.join(root, 'src/core/abroad-stocks.js'), 'utf8');
const context = {
  globalThis:null,
  Intl,
  Date,
  SLINK_EXTENSION:{
    core:{}, modules:{}, services:{},
    define(group, name, value) { this[group][name] = value; return value; }
  }
};
context.globalThis = context;
vm.runInNewContext(source, context, { filename:'src/core/abroad-stocks.js' });
const abroad = context.SLINK_EXTENSION.core.abroadStocks;
const assert = (condition, message) => { if (!condition) throw new Error(message); };

const fetchedAt = Date.now();
const yata = abroad.normalizeProvider('yata', {
  stocks:{
    mex:{
      name:'Mexico',
      update:fetchedAt,
      stocks:[{ id:206, name:'Xanax', quantity:41, cost:735000 }]
    }
  }
}, fetchedAt);
const prometheus = abroad.normalizeProvider('prometheus', {
  countries:[{
    country:'Mexico',
    updatedAt:fetchedAt - 1_000,
    items:[{ itemId:206, itemName:'Xanax', stock:39, price:735000 }]
  }]
}, fetchedAt);

assert(yata.length === 1, 'YATA country/item payload was not normalized.');
assert(yata[0].countryCode === 'mex' && yata[0].itemName === 'Xanax', 'Normalized YATA identity is wrong.');
assert(prometheus.length === 1 && prometheus[0].quantity === 39, 'Prometheus payload was not normalized.');

const futureItem = abroad.normalizeProvider('yata', {
  stocks:{
    mex:{
      stocks:[{ id:9999, name:'Future provider item', quantity:7, cost:123456 }]
    }
  }
}, fetchedAt);
assert(futureItem.length === 1 && futureItem[0].itemId === 9999, 'New provider items must not require a hard-coded catalog update.');

const futureCountry = abroad.normalizeProvider('prometheus', {
  data:{
    nzl:{
      name:'New Zealand',
      items:{
        777:{ item_name:'Kiwi', current_stock:4, buy_price:50 }
      }
    }
  }
}, fetchedAt);
assert(futureCountry.length === 1, 'Unknown provider destinations should not be silently discarded.');
assert(futureCountry[0].countryCode === 'nzl' && futureCountry[0].countryName === 'New Zealand', 'Dynamic country identity was not preserved.');
assert(futureCountry[0].itemId === 777 && futureCountry[0].quantity === 4, 'Object-keyed provider items were not normalized.');

const flatItems = abroad.normalizeProvider('tornIntel', {
  data:{
    items:[{ country_code:'mex', item_id:206, item_name:'Xanax', available:5, foreign_price:735000 }]
  }
}, fetchedAt);
assert(flatItems.length === 1 && flatItems[0].countryCode === 'mex' && flatItems[0].quantity === 5, 'Flat provider item lists were not normalized.');

const merged = abroad.mergeSnapshots({ yata, prometheus });
assert(merged.length === 1, 'Matching provider rows should merge into one country/item row.');
assert(merged[0].sources.yata.quantity === 41 && merged[0].sources.prometheus.quantity === 39, 'Merged provider readings are missing.');
assert(abroad.travelMinutes('mex', 'private', 3) === 15, 'Mexico private-flight travel calculation changed.');

const interval = 60 * 60_000;
const history = abroad.historyPrediction({ restocks:[fetchedAt - interval * 3, fetchedAt - interval * 2, fetchedAt - interval] });
assert(history.samples === 2, 'Restock history needs two observed intervals before becoming reliable.');
assert(history.nextRestockAt === fetchedAt, 'Restock prediction should use the median observed interval.');

const future = fetchedAt + 2 * interval;
const departure = abroad.departureAt({ countryCode:'mex', nextRestockAt:future }, { travelMethod:'private', arrivalBufferMinutes:3 });
assert(departure === future - 15 * 60_000, 'Departure time should subtract travel plus the configured arrival buffer.');

const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8'));
for (const origin of ['https://yata.yt/*','https://prombot.co.uk:8443/*','https://torn-intel.com/*','https://droqsdb.com/*']) {
  assert(manifest.host_permissions.includes(origin), `Missing provider host permission: ${origin}`);
}
assert(manifest.content_scripts[0].js.includes('src/core/abroad-stocks.js'), 'Abroad Stocks core is not loaded by the Torn content script.');
assert(manifest.content_scripts[0].js.includes('src/modules/abroad-stocks.js'), 'Abroad Stocks module is not loaded by the Torn content script.');

const worker = fs.readFileSync(path.join(root, 'src/background/service-worker.js'), 'utf8');
assert(worker.includes("'../core/abroad-stocks.js'"), 'Background worker does not load the Abroad Stocks core.');
assert(worker.includes("'abroad-stocks-service.js'"), 'Background worker does not load the Abroad Stocks service.');
assert(worker.includes('SLINK.services.abroadStocks.routes'), 'Background routes do not include Abroad Stocks.');

console.log('Abroad Stocks validation passed.');

const strict=(await import('node:assert/strict')).default;
const moduleSource=fs.readFileSync(path.join(root,'src/modules/abroad-stocks.js'),'utf8');
const startLoad=moduleSource.indexOf('      async function load('),endLoad=moduleSource.indexOf('      try {await load(true);}',startLoad);
strict(startLoad>=0&&endLoad>startLoad);
const requests=[];
const controller={context:{signal:{aborted:false}},stopped:false,status:{settings:{arrivalBufferMinutes:3}},settingsRevision:0,requestSequence:0,appliedSequence:0,pendingWatches:new Set(),autosave:{busy:false},renders:0,updates:0,
 SLINK:{core:{messaging:{send(type,payload){let resolve;const promise=new Promise(done=>{resolve=done;});requests.push({type,payload,resolve});return promise;}}}},render(){controller.renders++;},updateStatus(){controller.updates++;}};
vm.createContext(controller);vm.runInContext(moduleSource.slice(startLoad,endLoad),controller);
const oldRead=controller.load(false);
strict.equal(requests[0].type,'abroadStocks.status');strict.equal(requests[0].payload.refreshIfDue,false,'Preference preview must never force provider/Torn requests');
controller.settingsRevision+=2;controller.status.settings.arrivalBufferMinutes=0;
requests[0].resolve({settings:{arrivalBufferMinutes:3},rows:[{key:'fresh-row'}]});await oldRead;
strict.equal(controller.status.settings.arrivalBufferMinutes,0);strict.equal(controller.status.rows[0].key,'fresh-row');
const earlier=controller.load(false),later=controller.load(false);
requests[2].resolve({settings:{arrivalBufferMinutes:0},rows:[{key:'newer'}]});await later;
requests[1].resolve({settings:{arrivalBufferMinutes:0},rows:[{key:'older'}]});await earlier;
strict.equal(controller.status.rows[0].key,'newer','Older status completion cannot undo a newer view response');
controller.pendingWatches.add('one');const before=requests.length;await controller.load(true);strict.equal(requests.length,before);controller.pendingWatches.clear();
const stoppedRead=controller.load(false);controller.stopped=true;const rendered=controller.renders;
requests.at(-1).resolve({settings:{arrivalBufferMinutes:20}});await stoppedRead;strict.equal(controller.renders,rendered);
console.log('Abroad controller: cached-only preview, newer settings/status fencing, watch guard and stopped-response isolation passed.');
