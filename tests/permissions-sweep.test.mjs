import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { existsSync } from 'node:fs';
import vm from 'node:vm';

const text = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const permissions = text('src/core/permissions.js');
assert.ok(!permissions.includes('SOLE_ADMIN_USER_ID'));
assert.ok(permissions.includes("scope === '*' || scope === 'admin.*'"));

const expected = new Map([
  ['src/modules/abroad-stocks.js', 'slink.qol.abroad-stocks'],
  ['src/modules/adhd.js', 'slink.adhd.alerts'],
  ['src/modules/bounties.js', 'slink.combat.bounties'],
  ['src/modules/company.js', 'slink.qol.company'],
  ['src/modules/dollar-bazaars.js', 'slink.efficiency.dollar-bazaars'],
  ['src/modules/events.js', 'slink.qol.events'],
  ['src/modules/money-property.js', 'slink.qol.money-property'],
  ['src/modules/museums.js', 'slink.qol.museum'],
  ['src/modules/mugging.js', 'slink.mugging'],
  ['src/modules/player-stats.js', 'slink.combat.player-stats'],
  ['src/modules/racing.js', 'slink.qol.racing'],
  ['src/modules/target-list.js', 'slink.combat.target-list'],
  ['src/core/merits.js', 'slink.efficiency.merits']
]);
const context=vm.createContext({console,URL,URLSearchParams,AbortController,setTimeout,clearTimeout});
for(const path of ['src/core/runtime.js','src/core/format.js','src/core/permissions.js','src/core/modules.js'])
  vm.runInContext(text(path),context,{filename:path});
const slink=context.SLINK_EXTENSION;
for(const [path,scope]of expected){
  if(path.startsWith('src/core/')){
    vm.runInContext(text(path),context,{filename:path});
    assert.equal(slink.core.merits.REQUIRED_SCOPE,scope);
    assert.equal(slink.core.permissions.hasScope({scopes:[]},scope),false);
    assert.equal(slink.core.permissions.hasScope({scopes:[scope]},scope),true);
    assert.equal(slink.core.permissions.hasScope({userId:123,scopes:['admin.*']},scope),true);
    continue;
  }
  const core=path==='src/modules/museums.js'?'src/core/museum.js':path.replace('src/modules/','src/core/');
  if(existsSync(new URL('../'+core,import.meta.url)))vm.runInContext(text(core),context,{filename:core});
  const count=slink.modules.list().length;
  vm.runInContext(text(path),context,{filename:path});
  assert.equal(slink.modules.list().length,count+1,`${path} must register its module`);
  const module=slink.modules.list().at(-1);
  assert.deepEqual(Array.from(module.requiredScopes),[scope],`${path} resolved the wrong registered scope`);
  assert.equal(slink.modules.canAccess(module,{scopes:[]}),false,`${path} allowed a denied user`);
  assert.equal(slink.modules.canAccess(module,{scopes:['unrelated.scope']}),false);
  assert.equal(slink.modules.canAccess(module,{scopes:[scope]}),true,`${path} rejected its exact grant`);
  assert.equal(slink.modules.canAccess(module,{userId:123,scopes:['admin.*']}),true,`${path} rejected a backend-issued admin grant`);
}
vm.runInContext(text('src/core/travel-safety.js'),context);
vm.runInContext(text('src/modules/travel-safety.js'),context);
assert.equal(slink.modules.canAccess(slink.modules.list().at(-1),{scopes:[]}),true,'Headless travel safety must remain unpermissioned');
for (const [path, scopes] of new Map([
  ['src/modules/chat.js', ['slink.qol.chat', 'admin.*']],
  ['src/modules/war.js', ['slink.war', 'slink.war.officer', 'slink.officer.armory', 'admin.*']]
])) {
  const source = text(path);
  for (const scope of scopes) assert.ok(source.includes(`'${scope}'`), `${path} is missing its explicit ${scope} disposition.`);
  assert.ok(source.includes('permissionTest'), `${path} must gate optional-scope access in the module registry.`);
}
assert.ok(text('src/modules/faction-officers.js').includes('CORE.ADMIN_SCOPE,...SCOPES'), 'Faction Officers must be available only through one of its explicit officer scopes or admin.*.');
for (const scope of ['slink.war.officer', 'slink.officer.armory', 'slink.officer.oc', 'admin.*'])
  assert.ok(text('src/core/faction-officers.js').includes(`'${scope}'`), `Faction Officer scope catalog is missing ${scope}.`);
for (const path of ['src/modules/contribution.js', 'src/modules/travel-safety.js']) {
  const source = text(path);
  assert.ok(source.includes('requiredScopes:[]'), `${path} must make its no-permission disposition explicit.`);
  assert.ok(!source.includes('permissionTest:'), `${path} unexpectedly adds a permission gate.`);
}
assert.ok(text('src/modules/market.js').includes('marketWatchLimit(permissions) > 0'), 'Market Watch must retain its per-tier permission gate.');
console.log('Permission sweep validation passed.');
