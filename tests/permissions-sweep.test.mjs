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
  ['src/modules/bounties.js', 'slink.combat.bounties'],
  ['src/modules/dollar-bazaars.js', 'slink.efficiency.dollar-bazaars'],
  ['src/modules/events.js', 'slink.qol.events'],
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
  const core=path.replace('src/modules/','src/core/');
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
console.log('Permission sweep validation passed.');
