import assert from 'node:assert/strict';
await import('../src/content/mission-preview.js');
const {hint,integer,parse,reward}=globalThis.SLINK_MISSION_PREVIEW;
const now=1700000000000, prices=new Map([[7,{marketPrice:200,priceAvailable:true,priceCheckedAt:now-1000}]]);
const item=parse('{"points":100,"image":7,"amount":3,"basicType":"Item"}');
assert.match(hint(' Show Some Muscle * '),/don’t need to win/);
assert.equal(hint('constructor'),null);
assert.equal(integer('1,250'),1250);
assert.equal(integer('12,50'),null);
assert.deepEqual(reward(item,prices,{inventory:{inventory:[{ID:7,quantity:2},{ID:7,quantity:1}]}},now),{total:600,owned:3,progress:[]});
assert.equal(reward(item,prices,{},now+86400000).total,null);
assert.equal(reward(item,prices,{},now).owned,null);
assert.equal(parse('invalid'),null);
const ammo={basicType:'Ammo',title:'12 Gauge Shotgun Shell',ammoType:'Incendiary',weapons:[{ammoType:5}]};
const account={ammo:{ammo:[{id:5,types:[{name:'Incendiary',quantity:48}]}]},progress:{honors:[],personalstats:{specialammoused:145,incendiaryammoused:110}}};
assert.deepEqual(reward(ammo,prices,account,now),{total:null,owned:48,progress:[
  {label:'Dragon’s Breath',count:0,goal:1},{label:'Bandolier',count:145,goal:1000},{label:'Scorched',count:110,goal:2500}
]});
account.progress.honors=[951];
assert.ok(!reward(ammo,prices,account,now).progress.some(row=>row.label==='Dragon’s Breath'));
assert.deepEqual(reward(ammo,prices,{},now),{total:null,owned:null,progress:[]});
const hollow={...ammo,ammoType:'Hollow Point'};
assert.deepEqual(reward(hollow,prices,{progress:{personalstats:{hollowammoused:76}}},now).progress,[{label:'Maimed',count:76,goal:2500}]);
console.log('Mission rewards: hints, known ownership, value, and merit progress passed');
