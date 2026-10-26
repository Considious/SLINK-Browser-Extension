import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../src/modules/market.js', import.meta.url), 'utf8');
function extract(name) {
  const start = source.indexOf(`      function ${name}(`);
  assert(start >= 0, `Missing purchase helper: ${name}`);
  const end = source.indexOf('\n      }', start);
  assert(end > start);
  const result = source.slice(start, end + 8);
  new vm.Script(result);
  return result;
}
const delays = [];
const sandbox = vm.createContext({
  Date:{now:() => 100_000},
  scheduleQuickPurchaseControlSync:delay => delays.push(delay),
  purchaseState:{quickPurchaseFlow:null,settings:{highlightedQuickBuyEnabled:true}},
  QUICK_PURCHASE_TRANSITION_TIMEOUT_MS:2_500,
  QUICK_PURCHASE_FLOW_TIMEOUT_MS:10_000,
  quickPurchaseConfirmation:() => null,
  bazaarListingCards:() => [],highlightedQuickPurchaseElements:() => [],
  itemMarketQuantityInput:row => row.input,
  getComputedStyle:() => ({backgroundColor:'black',borderColor:'black',color:'white'}),
  bazaarCssColorLooksRed:() => false
});
vm.runInContext(['quickPurchaseAnchor','desiredFlowStageControl','desiredBazaarFlowWaitControl','desiredQuickPurchaseControls','itemMarketRowUnavailable'].map(extract).join('\n'), sandbox);
const native = {getBoundingClientRect:() => ({left:120,top:240,width:70,height:30})};
const listing = {element:{getBoundingClientRect:() => ({left:100,top:200})}};
const anchor = sandbox.quickPurchaseAnchor(native, listing);
assert.equal(JSON.stringify(anchor), JSON.stringify({offsetLeft:20,offsetTop:40,viewportLeft:120,viewportTop:240,width:70,height:30}));
const flow = {anchor,controlKey:'item:206',lastActionAt:99_500,lastStage:'buy',lastNative:native};
const desired = new Map();
sandbox.desiredFlowStageControl(desired,native,{stage:'buy',label:'Buy max'},flow);
assert.equal(desired.get(flow.controlKey).anchor, anchor, 'Keep the original anchor during native transitions');
assert.equal(desired.get(flow.controlKey).disabled,true);
assert.equal(desired.get(flow.controlKey).label,'Wait');
assert.equal(delays.at(-1),1_020);
flow.lastActionAt=90_000;
sandbox.desiredFlowStageControl(desired,native,{stage:'buy',label:'Buy max'},flow);
assert.equal(desired.get(flow.controlKey).label,'Buy max');
assert.equal(desired.get(flow.controlKey).anchor,anchor);
flow.lastActionAt=99_500;
sandbox.purchaseState.quickPurchaseFlow=flow;
sandbox.desiredBazaarFlowWaitControl(desired,flow,listing);
assert.equal(desired.get(flow.controlKey).stage,'waiting');
assert.equal(desired.get(flow.controlKey).anchor,anchor);
flow.lastActionAt=97_000;
sandbox.desiredBazaarFlowWaitControl(new Map(),flow,listing);
assert.equal(sandbox.purchaseState.quickPurchaseFlow,null,'Do not retain a stuck native transition indefinitely');
sandbox.purchaseState.quickPurchaseFlow={startedAt:89_999};
assert.equal(sandbox.desiredQuickPurchaseControls().size,0);
assert.equal(sandbox.purchaseState.quickPurchaseFlow,null,'Expire the complete purchase flow after ten seconds');
sandbox.purchaseState.settings.highlightedQuickBuyEnabled=false;
assert.equal(sandbox.desiredQuickPurchaseControls().size,0,'Respect disabled SLINK Buy without creating controls');

const button = {disabled:true,matches:() => false};
const row = {input:{disabled:false,readOnly:false},textContent:'10 available',querySelector:() => null,querySelectorAll:() => [button]};
assert.equal(sandbox.itemMarketRowUnavailable(row),false,'Torn disables Buy until quantity is filled; this is not a sold-out listing');
for (const field of ['disabled','readOnly']) {
  row.input[field]=true;
  assert.equal(sandbox.itemMarketRowUnavailable(row),true,`Reject a ${field} quantity input`);
  row.input[field]=false;
}
row.input=null;
assert.equal(sandbox.itemMarketRowUnavailable(row),true);
row.input={};
row.querySelectorAll=() => [];
assert.equal(sandbox.itemMarketRowUnavailable(row),true,'A missing native Buy control is unavailable');
row.querySelectorAll=() => [button];
row.textContent='Sold out';
assert.equal(sandbox.itemMarketRowUnavailable(row),true);
console.log('Purchase anchors, transition recovery and native quantity availability passed.');
