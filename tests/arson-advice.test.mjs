import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const SLINK_EXTENSION={core:{},define(group,id,value){this[group][id]=value;}};
vm.runInNewContext(fs.readFileSync(new URL('../src/core/arson-advice.js',import.meta.url),'utf8'),{SLINK_EXTENSION});
const {describe,remainingCost,rankJobs,generateJobFormulas}=SLINK_EXTENSION.core.arsonAdvice;
const job={jobId:'fixture',phase:'preparation',revision:2,complete:true,requirements:[],currentNerve:30};
const tank={name:'Oxygen Tank',ownedQty:1,usableNow:true,revision:2,action:'place',nerveCost:5};
assert.equal(describe(tank,job).status,'compatible');
assert.equal(describe({...tank,ownedQty:0},job).status,'unavailable');
assert.equal(describe({...tank,ownedQty:null},job).status,'unknown');
assert.equal(describe({...tank,revision:1},job).status,'unknown');
assert.equal(describe({name:'Kerosene'}, {...job,skill:40}).status,'unknown');
const insurance={...job,requirements:[{kind:'insurance'},{kind:'family',family:'gas'}]};
assert.equal(describe({...tank,name:'Gasoline'},insurance).status,'incompatible');
assert.equal(describe(tank,insurance).status,'conditional');
assert.equal(describe(tank,{...job,requirements:[{kind:'maxDamage',max:40}]}).status,'conditional');
const inventory=new Map([['Oxygen Tank',tank],['Lighter',{ownedQty:1}]]);
const prices=new Map([['Oxygen Tank',{unitPrice:100,stale:false,source:'fixture',fetchedAt:1}]]);
const steps=[{quantity:1,nerveCost:3},{name:'Oxygen Tank',quantity:1,nerveCost:5},{name:'Oxygen Tank',quantity:2,nerveCost:5},{name:'Lighter',quantity:1,nerveCost:5},{quantity:1,nerveCost:2}];
const result=remainingCost(steps,inventory,prices);
assert.equal(result.nerve,25);
assert.equal(result.materials,300);
assert.equal(result.stock,'insufficient');
assert.equal(remainingCost(steps,inventory,new Map()).materials,null);
assert.equal(remainingCost(steps,inventory,new Map([['Oxygen Tank',{...prices.get('Oxygen Tank'),stale:true}]])).materials,null);
const economy={id:'economy',jobId:'a',revision:2,compatibility:'confirmed',estimatedPayout:5000,estimatedSkill:600,totalNerve:5,steps:[{name:'Oxygen Tank',quantity:1,nerveCost:5}]};
const experience={...economy,id:'skill',estimatedPayout:3000,estimatedSkill:800};
const jobs=[{...job,jobId:'a',candidates:[economy,experience]},
  {...job,jobId:'b',candidates:[{...economy,jobId:'b'}]},
  {...job,jobId:'unknown',complete:false,candidates:[{...economy,jobId:'unknown'}]},
  {...job,jobId:'stale',revision:3,candidates:[{...economy,jobId:'stale'}]},
  {...job,jobId:'blocked',candidates:[{...economy,jobId:'blocked',compatibility:'unknown'}]},
  {...job,jobId:'wrong-job',candidates:[economy]}];
assert.deepEqual(Array.from(rankJobs(jobs,inventory,prices),row=>row.recommended?.candidate.id||null),['economy','economy',null,null,null,null]);
assert.equal(rankJobs(jobs,inventory,prices,'skillPerNerve')[0].recommended.candidate.id,'skill');
assert.equal(rankJobs(jobs,inventory,new Map())[0].recommended,null);
assert.equal(rankJobs(jobs,inventory,new Map(),'skillPerNerve')[0].recommended.candidate.id,'skill');
const preferred={...economy,id:'preferred',steps:[{name:'Oxygen Tank',quantity:2,nerveCost:5}],totalNerve:10};
const fallback={...economy,id:'fallback',replaces:'preferred'};
const wrong={...economy,id:'wrong',compatibility:'incompatible',estimatedPayout:99999,replaces:'preferred'};
const replacement=rankJobs([{...jobs[0],candidates:[preferred,wrong,fallback]}],inventory,prices)[0];
assert.equal(replacement.recommended.candidate.id,'fallback');
assert.equal(replacement.substitution.preferredId,'preferred');
assert.equal(rankJobs([{...jobs[0],candidates:[preferred,wrong]}],inventory,prices)[0].recommended,null);
const gasJob={...job,jobId:'gas',targetKey:'synthetic',action:'place',actionNerveCost:5,
  requirements:[{kind:'family',family:'gas'},{kind:'insurance'}],usableMaterials:['Oxygen Tank','Gasoline']};
const shared=new Map([...inventory,['Gasoline',{ownedQty:10}],['Methane Tank',{ownedQty:0}]]);
const place=name=>({action:'place',name,quantity:1,nerveCost:5});
const collect={action:'collect',quantity:1,nerveCost:2};
const ignite={action:'ignite',name:'Lighter',quantity:1,nerveCost:5};
const template={id:'preferred',targetKey:'synthetic',phase:'preparation',evidence:'validated',
  insuranceAssessment:{status:'pass',evidence:'validated',suspicion:1},
  requirements:['insurance','family:gas'],steps:[place('Oxygen Tank'),place('Methane Tank'),ignite,collect],
  estimatedPayout:4000,totalNerve:17,estimatedSkill:600};
const alternate={...template,id:'alternate',replaces:'preferred',steps:[place('Oxygen Tank'),ignite,collect],totalNerve:12,estimatedPayout:3000};
const invalid={...alternate,id:'invalid',estimatedPayout:9000,steps:[place('Gasoline'),ignite,collect]};
const formulas=generateJobFormulas([gasJob,{...gasJob,jobId:'other',targetKey:'unverified'},
  {...gasJob,jobId:'unknown',requirements:[...gasJob.requirements,{kind:'unknown'}]}],shared,prices,{templates:[template,alternate,invalid]});
assert.equal(formulas[0].recommended.candidate.id,'alternate');
assert.equal(formulas[0].substitution.preferredId,'preferred');
assert.equal(formulas[1].recommended,null);
assert.equal(formulas[2].recommended,null);
assert.deepEqual(Array.from(formulas[0].starters,row=>row.steps[0].name),['Oxygen Tank']);
assert.equal(formulas[0].starters[0].status,'conditional');
assert.equal(generateJobFormulas([{...gasJob,currentNerve:4}],shared,prices,{templates:[alternate]})[0].recommended,null);
assert.equal(generateJobFormulas([{...gasJob,usableMaterials:[]}],shared,prices,{templates:[alternate]})[0].starters.length,0);
const insuranceOnly={...gasJob,requirements:[{kind:'insurance'}]};
const gasolineRecipe={...invalid,requirements:['insurance'],estimatedSkill:999999};
const oxygenRecipe={...alternate,requirements:['insurance']};
assert.equal(describe({...tank,name:'Gasoline'},insuranceOnly).status,'incompatible');
for(const objective of ['profit','skillPerNerve']){
  const result=generateJobFormulas([insuranceOnly],shared,prices,{objective,templates:[gasolineRecipe,oxygenRecipe]})[0];
  assert.equal(result.recommended.candidate.id,'alternate');
  assert.deepEqual(Array.from(result.starters,row=>row.steps[0].name),['Oxygen Tank']);
  assert.equal(generateJobFormulas([insuranceOnly],shared,prices,{objective,templates:[gasolineRecipe]})[0].recommended,null);
}
for(const name of ['Gasoline','Magnesium Shavings']){
  assert.equal(describe({...tank,name},insuranceOnly).status,'incompatible');
}
const costlyLow={...oxygenRecipe,id:'lower-suspicion',estimatedPayout:100,estimatedSkill:1,
  insuranceAssessment:{status:'pass',evidence:'validated',suspicion:0}};
const profitableHigher={...oxygenRecipe,id:'higher-suspicion',estimatedPayout:99999,estimatedSkill:99999};
const unsafeFlow={...costlyLow,id:'unsafe',steps:[place('Oxygen Tank'),{...ignite,name:'Flamethrower'},collect]};
const unverified={...costlyLow,id:'unverified',insuranceAssessment:{status:'unknown',evidence:'heuristic',suspicion:-100}};
const failedFlow={...costlyLow,id:'failed-flow',insuranceAssessment:{status:'fail',evidence:'validated',suspicion:12}};
const noPrice=generateJobFormulas([insuranceOnly],shared,new Map(),{templates:[costlyLow]})[0];
const capped={...insuranceOnly,requirements:[{kind:'insurance'},{kind:'damage',limit:{kind:'maximum',max:25,label:'Less than 25% damage required'}}]};
const underCap={...costlyLow,requirements:['insurance','damage:less than 25% damage required'],
  damageAssessment:{status:'pass',evidence:'validated',min:18,max:24.9}};
const hitsCap={...underCap,id:'at-cap',estimatedPayout:999999,damageAssessment:{...underCap.damageAssessment,max:25}};
assert.equal(generateJobFormulas([capped],shared,prices,{templates:[hitsCap,underCap]})[0].recommended.candidate.id,underCap.id);
assert.equal(generateJobFormulas([capped],shared,prices,{templates:[hitsCap]})[0].recommended,null);
assert.equal(generateJobFormulas([capped],shared,prices,{templates:[{...underCap,damageAssessment:undefined}]})[0].starters.length,0);
assert.equal(noPrice.recommended.candidate.id,'lower-suspicion');
assert.equal(noPrice.recommended.score,null);
const accidentalOnly={...insuranceOnly,requirements:[{kind:'accidental'}]};
const accidentalRecipe={...costlyLow,requirements:['accidental'],insuranceAssessment:undefined,
  accidentalAssessment:{status:'pass',evidence:'validated',suspicion:1}};
const highSuspicionRecipe={...accidentalRecipe,id:'higher',estimatedPayout:99999,estimatedSkill:99999,
  accidentalAssessment:{...accidentalRecipe.accidentalAssessment,suspicion:2}};
const accidentalAndInsurance={...insuranceOnly,requirements:[{kind:'accidental'},{kind:'insurance'}]};
const combinedRecipe={...accidentalRecipe,requirements:['accidental','insurance']};
for(const objective of ['profit','skillPerNerve']){
  const result=generateJobFormulas([accidentalOnly],shared,prices,{objective,templates:[highSuspicionRecipe,accidentalRecipe]})[0];
  assert.equal(result.recommended.candidate.id,accidentalRecipe.id);
  const blocked=generateJobFormulas([accidentalOnly],shared,prices,{objective,templates:[{...accidentalRecipe,accidentalAssessment:undefined,insuranceAssessment:costlyLow.insuranceAssessment}]})[0];
  assert.equal(blocked.recommended,null);assert.equal(blocked.starters.length,0);assert.match(blocked.reason,/Accidental Cause/);
  assert.equal(generateJobFormulas([accidentalAndInsurance],shared,prices,{objective,templates:[combinedRecipe]})[0].recommended,null);
  assert.ok(generateJobFormulas([accidentalAndInsurance],shared,prices,{objective,templates:[{...combinedRecipe,insuranceAssessment:costlyLow.insuranceAssessment}]})[0].recommended);
}
for(const level of ['high','low']){
  const visibleJob={...insuranceOnly,requirements:[{kind:'insurance'},{kind:'visibility',level}]};
  const formula={...oxygenRecipe,requirements:['insurance','visibility:'+level],
    visibilityAssessment:{level,status:'pass',evidence:'validated',visibility:5}};
  const preferredVisibility={...formula,id:'better-visibility',estimatedPayout:1,estimatedSkill:1,
    visibilityAssessment:{...formula.visibilityAssessment,visibility:level==='high'?6:4}};
  const wrongVisibility={...formula,id:'wrong-visibility',estimatedPayout:999999,estimatedSkill:999999,
    visibilityAssessment:{...formula.visibilityAssessment,level:level==='high'?'low':'high'}};
  const failedInsurance={...formula,insuranceAssessment:{...formula.insuranceAssessment,status:'fail'}};
  const unknownVisibility={...formula,visibilityAssessment:{...formula.visibilityAssessment,evidence:'heuristic'}};
  for(const objective of ['profit','skillPerNerve']){
    const options={objective,templates:[formula,wrongVisibility,preferredVisibility,failedInsurance,unknownVisibility]};
    const result=generateJobFormulas([visibleJob],shared,prices,options)[0];
    assert.equal(result.recommended.candidate.id,'better-visibility');
    const blocked=generateJobFormulas([visibleJob],shared,prices,{objective,templates:[wrongVisibility,failedInsurance,unknownVisibility]})[0];
    assert.equal(blocked.recommended,null);assert.equal(blocked.starters.length,0);assert.match(blocked.reason,/Skip this job/);
  }
}
for(const objective of ['profit','skillPerNerve']){
  const result=generateJobFormulas([insuranceOnly],shared,prices,{objective,templates:[profitableHigher,costlyLow,unsafeFlow,unverified]})[0];
  assert.equal(result.recommended.candidate.id,'lower-suspicion');
  const blocked=generateJobFormulas([insuranceOnly],shared,prices,{objective,templates:[unsafeFlow,unverified,failedFlow]})[0];
  assert.equal(blocked.recommended,null);assert.equal(blocked.starters.length,0);assert.match(blocked.reason,/Skip this job/);
}
console.log('Arson advice: revision, compatibility, unknowns, reusable tools, stock allocation and cost accounting passed.');
