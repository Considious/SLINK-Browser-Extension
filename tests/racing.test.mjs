import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = fs.readFileSync(path.join(root, 'src/core/racing.js'), 'utf8');
const context = {
  globalThis:null,
  SLINK_EXTENSION:{
    core:{}, modules:{}, services:{},
    define(group, name, value) { this[group][name] = value; return value; }
  }
};
context.globalThis = context;
vm.runInNewContext(source, context, { filename:'src/core/racing.js' });
const racing = context.SLINK_EXTENSION.core.racing;
const assert = (condition, message) => { if (!condition) throw new Error(message); };

assert(racing.RECOMMENDED_BUILDS.length === 10, 'Expected all ten initial Class A builds.');
assert(racing.RECOMMENDED_BUILDS.every(build => build.class === 'A'), 'Initial guide must identify Class A builds.');
assert(racing.RECOMMENDED_BUILDS.every(build => racing.suggestNickname(build.tracks).valid), 'Every suggested nickname must fit Torn\'s limit.');
assert(racing.suggestNickname(['Meltdown','Vector','Industrial']).value === 'Meltdwn|Vect|Industria', 'Known three-track nickname changed.');
assert(racing.suggestNickname(['Withdrawal','Speedway','Uptown']).value === 'Withdraw|Speedwy|Uptow', 'Known LFA nickname changed.');
assert(racing.suggestNickname(['Underdog','Commerce','Sewage']).value === 'UndrDog|Commer|Sewage', 'Known NSX nickname changed.');
assert(racing.parseOfficialRaceTrack('Sewage - Official race') === 'Sewage', 'Official-race track parser failed.');
assert(racing.parseOfficialRaceTrack('Sewage - Custom race') === null, 'Custom races must not activate the assistant.');
assert(racing.RACEWAY_DOM.OFFICIAL_RACE_TRACK_SELECTOR === '.enlisted-btn-wrap', 'Official-race selector must use the supplied Torn hook.');
assert(racing.RACEWAY_DOM.OFFICIAL_RACE_CAR_NAME_SELECTOR.includes('model-car-name-'), 'Car selector must use the supplied Torn class prefix.');

const needed = racing.recommendationForTrack('Sewage', {});
assert(needed.status === 'not-completed', 'Needed builds must not be recommended as ready.');
const ready = racing.recommendationForTrack('Sewage', { builds:{ [needed.definition.id]:{ completed:true, customName:'' } } });
assert(ready.status === 'ready', 'Completed build should be ready.');
assert(ready.nickname === 'UndrDog|Commer|Sewage', 'Completed build should use its expected nickname.');
assert(racing.matchVisibleCar(ready.nickname, [{ name:'Other car' }, { name:ready.nickname }])?.name === ready.nickname, 'Exact nickname matching failed.');
assert(racing.matchVisibleCar(ready.nickname, [{ name:'UndrDog|Commer' }]) === null, 'Partial nickname must not match.');
assert(racing.validateNickname('12345678901234567890123').valid === false, 'Over-limit nickname must be rejected.');
assert(racing.buildsForView('needed', { builds:{ [needed.definition.id]:{ completed:true } } }).every(build => build.id !== needed.definition.id), 'Completed build remained in Needed.');
assert(racing.buildsForView('completed', { builds:{ [needed.definition.id]:{ completed:true } } }).some(build => build.id === needed.definition.id), 'Completed build missing from Completed.');

console.log('Racing model validation passed.');
