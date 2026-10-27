import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';

const code = fs.readFileSync(new URL('../src/core/money-property.js', import.meta.url), 'utf8');
const sandbox = { console, globalThis:null, SLINK_EXTENSION:{ core:{}, define(namespace,name,value){ this[namespace] ||= {}; this[namespace][name] = value; } } };
sandbox.globalThis = sandbox;
vm.runInNewContext(code, sandbox);
const money = sandbox.SLINK_EXTENSION.core.moneyProperty;
const now = 1_800_000_000_000;
const status = money.buildStatus({
  user:{
    money:{ cash:2_000_000, faction:{ money:4_000_000 }, city_bank:{ amount:1_000_000, time_left:0 }, loan:{ amount:0 } },
    properties:[{ id:2, name:'Ranch', status:'owned' }],
    currentProperty:{ id:1, name:'Private Island', status:'rented', rented:{ days_left:2 }, upkeep_owed:1_500_000, lease_extension:{ status:'pending', period:30 } },
    honors:[{ name:'Another honor' }],
    stocks:[{ id:1, shares:50 }, { id:2, shares:0 }]
  },
  tornStocks:{ stocks:[
    { id:1, name:'Test Stock', acronym:'TST', current_price:1000, bonus:{ requirement:100, description:'$700,000 every 7 days', frequency:7 } },
    { id:2, name:'No Income Stock', acronym:'NIX', current_price:1000, bonus:{ requirement:100, description:'Free advertising', frequency:7 } }
  ] }
}, { stockAlerts:{ '1:100':true } }, now);

assert.equal(status.money.availableCash, 6_000_000);
assert.equal(status.bank.matured, true);
assert.equal(status.currentProperty.upkeepOwed, 1_500_000);
assert.equal(status.stocks.length, 1);
assert.equal(status.stocks[0].incrementalCost, 50_000);
assert.equal(status.stocks[0].payoutValue, 700_000);
assert.equal(status.stocks[0].cadenceLabel, 'Every week');
assert.equal(status.stocks[0].affordable, true);
assert.ok(status.stocks[0].weeklyRoi > 0);
const alerts = money.buildAlerts(status, { stockAlerts:{ '1:100':true }, upkeepThreshold:1_000_000 }, now);
assert.ok(alerts.some(alert => alert.id === 'money-property:bank-matured'));
assert.ok(alerts.some(alert => alert.id === 'money-property:rental'));
assert.ok(alerts.some(alert => alert.id === 'money-property:upkeep'));
assert.ok(alerts.some(alert => alert.id === 'money-property:lease-extension'));
assert.ok(alerts.some(alert => alert.id === 'money-property:loan-shark'));
assert.ok(alerts.some(alert => alert.id === 'money-property:stock:1:100'));
const bankInput={
  rates:{bank:[{days:7,rate:35},{days:14,rate:39},{days:30,rate:48},{days:60,rate:24},{days:90,rate:47}]},
  userMerits:{merits:{upgrades:[{id:42,level:10}]}},
  meritCatalog:{merits:[{id:42,name:'Bank Interest'}]},
  tornStocks:{stocks:[{id:9,acronym:'TCI',bonus:{requirement:1500000}}]},
  userStocks:{stocks:[{id:9,shares:1500000,bonus:{available:true}}]}
};
const comparison=money.bankComparison(bankInput,2e9);
assert.equal(comparison.rows.length,5);
assert.equal(comparison.best,30);
assert.equal(comparison.rows[2].profit,comparison.rows[3].profit);
assert.ok(Math.abs(comparison.rows[0].effectiveApr-57.75)<1e-9);
assert.ok(money.bankComparison(bankInput,2000000001).error);
assert.ok(money.bankComparison({...bankInput,userMerits:null},2e9).error);
assert.equal(money.normalizeSettings({bankAmount:12345}).bankAmount,12345);

// Run the background refresh, checking its independent bank rate cache.
const store=new Map([['access.settings.v1',{tornKey:'fixture'}]]);
const requests=[];
Object.assign(sandbox.SLINK_EXTENSION.core,{
  storage:{get:async(key,fallback)=>store.get(key)??fallback,set:async(key,value)=>store.set(key,value)},
  tornApiLimiter:{reserve:async()=>{}},
  http:{requestJson:async(_,url)=>{
    requests.push(url);
    if(url.includes('/torn/items'))return {items:[{id:1,name:'Drug Pack',value:{market_price:100}}]};
    if(url.includes('/torn/bank'))return bankInput.rates;
    if(url.includes('/torn/merits'))return bankInput.meritCatalog;
    if(url.includes('/user/merits'))return bankInput.userMerits;
    if(url.includes('/user/stocks'))return bankInput.userStocks;
    if(url.includes('/torn/stocks'))return bankInput.tornStocks;
    if(url.includes('/user/money'))return {money:{wallet:12345}};
    return {};
  }},
  market:{catalogItems:body=>body.items.map(item=>({id:item.id,name:item.name,marketPrice:item.value.market_price}))},format:{errorMessage:error=>error.message},permissions:{hasScope:()=>true}
});
sandbox.SLINK_EXTENSION.services={permissionAccess:{settings:async()=>({tornKey:'fixture'}),ensureSession:async()=>{}}};
sandbox.crypto=(await import('node:crypto')).webcrypto;sandbox.TextEncoder=TextEncoder;
vm.runInNewContext(fs.readFileSync(new URL('../src/core/shared-data.js',import.meta.url),'utf8'),sandbox);
vm.runInNewContext(fs.readFileSync(new URL('../src/background/shared-data-service.js',import.meta.url),'utf8'),sandbox);
vm.runInNewContext(fs.readFileSync(new URL('../src/background/money-property-service.js',import.meta.url),'utf8'),sandbox);
const service=sandbox.SLINK_EXTENSION.services.moneyProperty;
assert.equal((await service.refresh(true)).status.money.cashOnHand,12345);
requests.length=0;
store.get('money-property.runtime.v2').fetchedAt=0;
const refreshed=await service.refresh(false);
assert.equal(money.bankComparison(refreshed.status.bankPlanner,2e9).rows.length,5);
assert.ok(!requests.some(url=>url.includes('/torn/bank')),'The extension must reuse bank rates within one hour.');
console.log('money and property tests passed');

for(const key of ['bankLeadHours','rentalLeadDays','cashierLeadHours','upkeepThreshold']) {
  assert.equal(money.normalizeSettings({[key]:0})[key],0,'Zero is a configured reminder threshold, not a missing default');
}
assert.equal(money.normalizeSettings({bankLeadHours:null}).bankLeadHours,2);
assert.equal(money.normalizeSettings({upkeepThreshold:''}).upkeepThreshold,1000000);

// Execute the real module's status controller with delayed replies, separately
// from the real-browser tests of its mounted controls/shared autosave helper.
const moneyModule=fs.readFileSync(new URL('../src/modules/money-property.js',import.meta.url),'utf8');
const loadStart=moneyModule.indexOf('      async function load('),loadEnd=moneyModule.indexOf("      context.listen(root,'click'",loadStart);
assert(loadStart>=0&&loadEnd>loadStart);
const moneyReads=[];
const moneyController={busy:false,stopped:false,mounted:true,notice:'',settingsRevision:0,data:{settings:{bankAmount:100}},context:{signal:{aborted:false}},autosave:{busy:false},renders:0,statusUpdates:0,previews:0,
 root:{querySelector:()=>({disabled:false})},SLINK:{core:{messaging:{send(type,payload){let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});moneyReads.push({type,payload,resolve,reject});return promise;}},format:{errorMessage:error=>error.message}}},
 ui:{setStatus(){moneyController.statusUpdates++;}},render(){if(!moneyController.stopped)moneyController.renders++;},schedulePreview(){moneyController.previews++;}};
vm.createContext(moneyController);vm.runInContext(moneyModule.slice(loadStart,loadEnd),moneyController);
const oldMoneyRead=moneyController.load(false,false);await moneyController.load(true);
assert.equal(moneyReads.length,1,'Only one Money status request runs at a time');
assert.equal(moneyReads[0].payload.refreshIfDue,false);
moneyController.settingsRevision=2;moneyController.data.settings.bankAmount=999;
moneyReads[0].resolve({settings:{bankAmount:100},status:{marker:'fresh snapshot'}});await oldMoneyRead;
assert.equal(moneyController.data.settings.bankAmount,999);assert.equal(moneyController.data.status.marker,'fresh snapshot');
const failedRead=moneyController.load(false,false);moneyReads.at(-1).reject(Error('synthetic status failure'));await failedRead;
assert.equal(moneyController.notice,'synthetic status failure');assert.equal(moneyController.busy,false);
const stoppedRead=moneyController.load(true);moneyController.stopped=true;
const oldStatusUpdates=moneyController.statusUpdates,oldRenders=moneyController.renders;
moneyReads.at(-1).resolve({settings:{bankAmount:1}});await stoppedRead;
assert.equal(moneyController.statusUpdates,oldStatusUpdates);assert.equal(moneyController.renders,oldRenders);
console.log('Money controller: zero defaults, cached-only preview, late-settings fence, failed-read recovery and stopped UI isolation passed.');
