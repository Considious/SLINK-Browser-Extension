const assert=require('node:assert/strict');
require('../src/core/oc-participants.js');
const {identity,summarize}=globalThis.SLINK_OC_PARTICIPANTS;
assert.equal(identity({user_id:3,faction_id:5}),'3:5');
assert.equal(identity({userId:3}),'');
const crime={id:42,name:'Test OC',status:'Recruiting',slots:[
  {position:'Driver',user:{id:1},item_requirement:{id:2,is_available:false}},
  {position:'Guard',user:null,item_requirement:{id:2,is_available:false}},
  {position_info:{label:'Lookout'}},
  {position:'Hacker',user:{id:3,name:'Torn name'},item_requirement:{id:2,is_available:true}}
]};
const text=summarize([crime,{name:'Old OC',status:'Successful'}],new Map([[2,'Ladder']]),new Map([[1,'Alice']]));
assert.match(text,/Driver: Alice \[1\] · Missing Ladder/);
assert.match(text,/Guard: Open\n/);
assert.match(text,/Lookout: Assignment unavailable/);
assert.match(text,/Hacker: Torn name \[3\]$/);
assert.doesNotMatch(text,/Old OC/);
assert.equal(summarize([],new Map(),new Map()),'');
assert.match(summarize(Array(51).fill(crime),new Map(),new Map()),/first 50 active crimes/);
console.log('OC participants: assignments, open roles, unknown assignments, missing items and bounded results passed');
