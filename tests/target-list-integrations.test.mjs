import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const [leveling, bounties, war] = await Promise.all([
  readFile(new URL('../src/modules/leveling.js', import.meta.url), 'utf8'),
  readFile(new URL('../src/modules/bounties.js', import.meta.url), 'utf8'),
  readFile(new URL('../src/modules/war.js', import.meta.url), 'utf8')
]);

assert.match(leveling, /data-leveling-save-target/);
assert.match(leveling, /targetList\.add/);
assert.match(leveling, /tags:\['Level'\]/);
assert.match(leveling, /source:'leveling'/);

assert.match(bounties, /data-bounty-save-target/);
assert.match(bounties, /targetList\.add/);
assert.match(bounties, /tags:\['Target'\]/);
assert.match(bounties, /source:'bounties'/);

assert.match(war, /data-war-save-source="war"/);
assert.match(war, /data-war-save-source="outside"/);
assert.match(war, /targetList\.add/);
const start=war.indexOf("        for (const button of root.querySelectorAll('[data-war-save-target]'))");
const end=war.indexOf("        for (const button of root.querySelectorAll('[data-war-copy]'))",start);
assert(start>=0&&end>start,'War Save Target binding boundaries are missing');
for(const [kind,expectedSource,tag]of [['war','war','War'],['outside','outside-targets','Target']]){
 let click,payload;
 const button={dataset:{warSaveTarget:'42',warSaveSource:kind},textContent:'Save Target',isConnected:true,addEventListener:(type,fn)=>{assert.equal(type,'click');click=fn;}};
 const member={id:42,name:'Target',statusState:'Okay',battleStatsEstimate:500000,fairFight:2};
 const context=vm.createContext({root:{querySelectorAll:()=>[button]},current:{runtime:{snapshot:{members:[member]},outsideTargets:[member]},activeWar:{warId:'war-test'}},
 SLINK:{core:{messaging:{send:async(type,data)=>{assert.equal(type,'targetList.add');payload=data;}},format:{errorMessage:String}}},setTimeout:fn=>fn()});
 vm.runInContext("let localError='';"+war.slice(start,end),context);
 await click();
 assert.equal(payload.source,expectedSource);
 assert.equal(payload.tags[0],tag);
 assert.equal(payload.playerId,42);
 assert.equal(payload.sourceContext.battleStatsEstimate,500000);
 assert.equal(button.disabled,false,'Save action must release its busy state');
}

console.log('Target List source integration tests passed.');
