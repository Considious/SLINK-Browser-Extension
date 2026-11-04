import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
for(const source of ['../src/core/arson-page.js',...process.argv.slice(2)]){
 const context=vm.createContext({});
 vm.runInContext(fs.readFileSync(new URL(source,import.meta.url),'utf8'),context);
 const {captureArson,recipeJournal}=context.SLINK_ARSON_PAGE;
 let stored={},writes=0,t=1,outcome=null;
 const journal=recipeJournal({load:()=>structuredClone(stored),save:async v=>{stored=structuredClone(v);writes++;}});
 const capture=captureArson({record:journal.record,now:()=>t});
 const row={querySelector:()=>outcome},base={name:'Detective Agency',scenario:'Insurance',requestLabels:['Accidental cause requested'],usable:true,damage:0};
 const state=(action,extra={})=>({...base,action,...extra});
 const result=(text,success=true,reward=false)=>({textContent:text,matches:()=>success,querySelector:()=>reward?{}:null});
 const key=JSON.stringify([base.name,base.scenario,base.requestLabels]);
 function prepare(){
  outcome=null;capture.click(row,state('breach'));
  outcome=result('Opened the door');capture.inspect(row,state('place'));
  capture.click(row,state('place',{selected:'Fuel'}));
  outcome=result('Placed fuel');capture.inspect(row,state('ignite'));
  capture.click(row,state('ignite',{selected:'Lighter'}));
  outcome=result('Fire started');capture.inspect(row,state('collect'));
 }
 const ready=state('collect',{nerveCost:2,damage:58}),done={...ready,usable:false,disabledReason:'You have already collected your reward'};
 capture.click(row,ready);outcome=result('Reward',true,true);await capture.inspect(row,done);
 assert.equal(writes,0,'A partially observed job is not a recipe');
 prepare();capture.click(row,ready);await capture.inspect(row,ready);assert.equal(writes,0);
 outcome=result('Reward',true,true);await capture.inspect(row,done);await capture.inspect(row,done);
 assert.equal(writes,1);assert.deepEqual((await journal.find('arson',key)).steps.map(step=>step.item),['Fuel','Lighter']);
 prepare();capture.click(row,ready);outcome=result('Failure',false);await capture.inspect(row,done);assert.equal(writes,1);
 prepare();capture.click(row,ready);t+=16000;outcome=result('Reward',true,true);await capture.inspect(row,done);assert.equal(writes,1);
 prepare();capture.click(row,ready);capture.clear();outcome=result('Reward',true,true);await capture.inspect(row,done);assert.equal(writes,1);
}
console.log('Arson recipes: complete successful run, partial run, stale outcome, failure and lifecycle guards passed.');
