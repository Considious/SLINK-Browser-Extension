const {readFileSync}=require('node:fs');
const {join}=require('node:path');
const assert=require('node:assert/strict');
const {test}=require('node:test');
const read=path=>readFileSync(join(__dirname,'..',path),'utf8').replaceAll('\r\n','\n');
function readFn(source,name){
  const re=new RegExp('^  (?:async )?function '+name+'\\(','m');
  const start=source.search(re);
  assert.ok(start>=0,'Cannot find '+name);
  const end=source.indexOf('\n  }',start);
  assert.ok(end>start);
  return source.slice(start,end+4);
}
const bind=(source,name,mocks={})=>new Function(...Object.keys(mocks),readFn(source,name)+'\nreturn '+name)(...Object.values(mocks));
test('Paused War and Leveling do not claim a leader or schedule cycles/checks',async()=>{
  const war=read('src/background/war-service.js'),level=read('src/background/leveling-service.js');
  const monitoringEnabled=async()=>false, publicStatus=async()=>({monitoringPaused:true});
  for(const name of ['prepareCycle','prepareAlerts'])assert.deepEqual(await bind(war,name,{monitoringEnabled,publicStatus})(),{monitoringPaused:true});
  assert.equal((await bind(war,'claimLeader',{monitoringEnabled})()).leader,false);
  assert.deepEqual(await bind(level,'prepareCycle',{monitoringEnabled,publicStatus})(),{status:{monitoringPaused:true},checks:[]});
  assert.deepEqual(await bind(level,'checkTarget',{monitoringEnabled})({},null,async()=>{throw Error('Activity was touched');}),{skipped:true});
  assert.deepEqual(await bind(level,'submitAttackObservation',{monitoringEnabled})({targetId:42}),{skipped:true});
});
test('Paused Efficiency skips API refresh, including crime and mobility, without touching credentials',async()=>{
  const alerts=read('src/background/adhd-service.js');
  for(const name of ['refresh','refreshMobility','refreshCrimeWindows']){
    const fn=bind(alerts,name,{monitoringEnabled:async()=>false,publicStatus:async flag=>{assert.equal(flag,false);return {monitoringPaused:true};}});
    assert.deepEqual(await fn(true),{monitoringPaused:true});
  }
  const fn=bind(alerts,'tornJson',{monitoringEnabled:async()=>false,pausedError:()=>Error('paused')});
  await assert.rejects(fn('https://api.torn.com/v2/user','mock'),/paused/);
});
