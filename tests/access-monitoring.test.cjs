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

test('Paused Target List, Player Stats and Abroad Stocks stop their schedulers',async()=>{
  const target=read('src/background/target-list-service.js'),stats=read('src/background/player-stats-service.js'),abroad=read('src/background/abroad-stocks-service.js');
  const monitoringEnabled=async()=>false, never=()=>{throw Error('Paused module contacted its scheduler or network');};
  for(const name of ['runPolling','runStakeouts'])assert.deepEqual(await bind(target,name,{monitoringEnabled})({},null,never),{paused:true});
  assert.deepEqual(await bind(target,'activeAlerts',{monitoringEnabled})(),[]);
  assert.deepEqual(await bind(abroad,'activeAlerts',{monitoringEnabled})(),[]);
  const local={cached:true};
  assert.equal(await bind(stats,'refresh',{monitoringEnabled,CACHE_KEY:'fixture',SLINK:{core:{storage:{get:async()=>({data:local})}}}})(true),local);
  assert.deepEqual(await bind(abroad,'refresh',{monitoringEnabled,publicStatus:async refresh=>({refresh})})(true),{refresh:false});
  for(const [source,constant,id] of [[target,'POLL_ALARM','target-list'],[stats,'DAILY_ALARM','player-stats'],[abroad,'ALARM','abroad-stocks']]){
    const cleared=[];
    const chrome={alarms:{clear:async key=>cleared.push(key),get:never,create:never}};
    await bind(source,'ensureAlarm',{monitoringEnabled,chrome,global:{chrome},[constant]:id})();
    assert.deepEqual(cleared,[id]);
  }
});

test('Paused Bounties, Company, Museums, Events and Money keep cached state without requesting fresh data',async()=>{
  const monitoringEnabled=async()=>false;
  const publicStatus=async flag=>({cached:true,flag});
  for(const [id,name] of [['bounties','scanBatch'],['company','refresh'],['museum','refresh'],['events','refresh'],['money-property','refresh']]){
    const s=read('src/background/'+id+'-service.js');
    const paused=bind(s,name,{monitoringEnabled,publicStatus});
    assert.deepEqual(await paused(true),{cached:true,flag:id==='bounties'?undefined:false});
  }
  for(const id of ['company','money-property']){
    const s=read('src/background/'+id+'-service.js');
    assert.deepEqual(await bind(s,'activeAlerts',{monitoringEnabled})(),[]);
  }
  const ff=read('src/background/ff-bounties-service.js');
  let service;
  new Function('globalThis',ff)({SLINK_EXTENSION:{define:(_,__,value)=>{service=value;},core:{storage:{get:async()=>false}}},SLINK_FF_BOUNTIES:{service:()=>()=>{throw Error('FF provider contacted while paused');}}});
  await assert.rejects(service.routes['ffBounties.run']({action:'list'}),/paused/i);
});
