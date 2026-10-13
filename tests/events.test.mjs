import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

globalThis.SLINK_EXTENSION = {
  core:{},
  define(group, name, value) { this[group][name] = value; }
};
new Function(readFileSync(new URL('../src/core/events.js', import.meta.url), 'utf8'))();
const core = globalThis.SLINK_EXTENSION.core.events;
const now = Date.UTC(2026, 9, 12, 12);
const calendar = core.mergeCalendars({
  calendar:[
    { id:'halloween', name:'Halloween', start:Math.floor((now + 86_400_000) / 1000), end:Math.floor((now + 5 * 86_400_000) / 1000), description:'Collect treats.' },
    { id:'christmas', name:'Christmas Town', start:Math.floor((now + 30 * 86_400_000) / 1000), end:Math.floor((now + 40 * 86_400_000) / 1000) }
  ]
}, {
  calendar:[{ id:'personal-halloween', name:'Halloween', start:Math.floor((now + 2 * 86_400_000) / 1000) }]
}, now);
assert.equal(calendar.events.length, 2);
assert.equal(calendar.next.name, 'Halloween');
assert.equal(calendar.next.personalized, true);
assert.equal(calendar.next.startAt, now + 2 * 86_400_000);
assert.equal(core.selectEvent(calendar, 'christmas').name, 'Christmas Town');
assert.equal(core.plainText('<b>Event</b>&nbsp;guide'), 'Event guide');

assert.equal(core.HALLOWEEN_UPGRADE_ORDER.length, 20);
assert.deepEqual(core.HALLOWEEN_UPGRADE_ORDER.slice(0, 8).map(entry => entry.name), [
  'I See Dead People', "Here's Johnny", 'Doubler', 'Tripler', 'Quadrupler', 'Cat in Hell', 'Quintupler', 'Shadow of Doubt'
]);
assert.equal(core.halloweenBasketRank('Halloween Basket : Terrifying'), 'Terrifying');
assert.equal(core.halloweenBasketRank('Unrelated item'), '');

const completedThroughSeven = [1,2,3,4,5,13,6].map(upgradeId => ({ upgradeId, unlocked:true, disabled:false }));
const recommendation = core.halloweenRecommendations([
  ...completedThroughSeven,
  { upgradeId:23, name:'Shadow of Doubt', unlocked:false, disabled:true, selected:true },
  { upgradeId:19, name:'Multipack', unlocked:false, disabled:true },
  { upgradeId:20, name:'Deal with the Devil', unlocked:false, disabled:true }
]);
assert.equal(recommendation.completedCount, 7);
assert.deepEqual(recommendation.recommendations.map(entry => entry.name), ['Shadow of Doubt','Multipack','Deal with the Devil']);
assert.equal(recommendation.recommendations[0].disabled, true);
assert.equal(recommendation.recommendations[0].current, true);

const selectedIsNotUnlocked = core.halloweenRecommendations([{ upgradeId:13, name:'Cat in Hell', selected:true, unlocked:false }], 7);
assert.equal(selectedIsNotUnlocked.recommendations.some(entry => entry.name === 'Cat in Hell'), true);
assert.equal(core.isHalloweenEvent({ name:'Halloween' }), true);
assert.equal(core.isHalloweenEvent({ name:'Christmas Town' }), false);
console.log('SLINK Events tests passed.');

