import assert from 'node:assert/strict';
await import('../src/core/stocks-preview.js');
const s=globalThis.SLINK_STOCKS_MODEL;
assert.equal(s.threshold(2e6,2e6),6e6);
assert.equal(s.threshold(2e6,6e6),14e6);
assert.equal(s.threshold(100,100,{passive:true}),null);
assert.equal(s.threshold(100,102300,{cap:10}),null);
assert.equal(s.threshold(100,102299,{cap:10}),102300);
const price=new Map([[1,12]]);
assert.deepEqual(s.portfolio([{id:1,shares:3,transactions:[{shares:3,price:10}]}],price),{value:36,profit:6});
assert.deepEqual(s.portfolio([{id:1,shares:3,transactions:[{shares:2,price:10}]}],price),{value:36,profit:null});
assert.deepEqual(s.portfolio([{id:2,shares:3}],price),{value:null,profit:null});
assert.equal(s.quote(1000,12.5).shares,80);
assert.equal(s.quote(.3,.1).shares,3);
assert.equal(s.quote(999,100,true,9).exceeds,true);
assert.equal(s.quote(999,100,true,10).shares,10);
assert.equal(s.amount('$1,234.50'),1234.5);
for(const value of ['','0','-5','12,34','1e3','3.001'])assert.equal(s.amount(value),null);
console.log('Stocks: benefit tiers, portfolio, missing data, trade sizing and fee checks passed');

const fixture={
  holdings:[{id:1,shares:1}],
  market:[{id:1,acronym:'OWN',bonus:{}},{id:2,acronym:'AAA',bonus:{}},{id:3,acronym:'BBB',bonus:{}},{id:4,acronym:'CCC',bonus:{}},{id:25,acronym:'WSU',name:'West Side University',market:{price:2},bonus:{requirement:100,passive:true,description:'Education time reduction'}},{id:9,acronym:'PERK',bonus:{passive:true}}],
  cash:250,educationRemaining:true,
  benefitRows:[
    {id:1,acronym:'OWN',incrementalCost:10,weeklyValue:90,monthlyRoi:9},
    {id:2,acronym:'AAA',incrementalCost:100,weeklyValue:10,monthlyRoi:.2},
    {id:3,acronym:'BBB',incrementalCost:300,weeklyValue:30,monthlyRoi:.1},
    {id:4,acronym:'CCC',incrementalCost:200,weeklyValue:20,monthlyRoi:.3},
    {id:9,acronym:'PERK',incrementalCost:1,weeklyValue:1000,monthlyRoi:1000}
  ]
};
assert.deepEqual(s.recommendations(fixture).map(row=>row.id),[25,4,2]);
assert.deepEqual(s.recommendations(fixture,{sort:'weeklyValue'}).map(row=>row.id),[25,3,4]);
assert.deepEqual(s.recommendations(fixture,{affordableOnly:true}).map(row=>row.id),[25,4,2]);
assert.deepEqual(s.recommendations({...fixture,cash:150},{affordableOnly:true}).map(row=>row.id),[2]);
assert.deepEqual(s.recommendations({...fixture,educationRemaining:false}).map(row=>row.id),[4,2,3]);
assert.ok(!s.recommendations({...fixture,educationRemaining:null}).some(row=>row.id===25));
assert.deepEqual(s.recommendations({...fixture,cash:null},{affordableOnly:true}),[]);
assert.ok(!s.recommendations(fixture,{hidden:[25,4]}).some(row=>row.id===25||row.id===4));
const courses={education:[{courses:[{id:1},{id:2}]}]};
assert.equal(s.educationRemaining({education:{complete:[1]}},courses),true);
assert.equal(s.educationRemaining({education:{complete:[1,2]}},courses),false);
assert.equal(s.educationRemaining(null,courses),null);
assert.equal(s.educationRemaining({education:{complete:[]}},{education:[]}),null);
console.log('Stocks recommendations: ownership, education, affordability, exclusions and both sort orders passed');
