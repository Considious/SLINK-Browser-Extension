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
const yearRound = core.mergeCalendars({ calendar:[{ id:'christmas', name:'Christmas Town', start:Math.floor((now + 30 * 86_400_000) / 1000) }] }, {}, now);
assert.equal(yearRound.next.name, 'Christmas Town');
assert.equal(yearRound.events.some(event => event.id === 'guide:halloween' && event.guideOnly), true);
assert.equal(core.selectEvent(yearRound, 'guide:halloween').name, 'Halloween');
console.log('SLINK Events tests passed.');

const vm=await import('node:vm');
const eventsModule=readFileSync(new URL('../src/modules/events.js',import.meta.url),'utf8');
const loadStart=eventsModule.indexOf('      async function load('),loadEnd=eventsModule.indexOf("      context.listen(root, 'click'",loadStart);
assert(loadStart>=0&&loadEnd>loadStart);
const eventReads=[];
const eventsController={busy:false,stopped:false,mounted:true,notice:'',settingsRevision:0,data:{selectedId:'christmas',selected:{id:'christmas',name:'Christmas Town'}},context:{signal:{aborted:false}},autosave:{busy:false},renders:0,statusUpdates:0,
 root:{querySelector:()=>({disabled:false})},SLINK:{core:{messaging:{send(type,payload){let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});eventReads.push({type,payload,resolve,reject});return promise;}},format:{errorMessage:error=>error.message}}},
 ui:{setStatus(){eventsController.statusUpdates++;}},render(){if(!eventsController.stopped)eventsController.renders++;}};
vm.createContext(eventsController);vm.runInContext(eventsModule.slice(loadStart,loadEnd),eventsController);
const olderStatus=eventsController.load(false);await eventsController.load(true);assert.equal(eventReads.length,1,'Events allows one active calendar status request');
eventsController.settingsRevision+=2;eventsController.data.selectedId='guide:halloween';eventsController.data.selected={id:'guide:halloween',name:'Halloween'};
eventReads[0].resolve({selectedId:'christmas',selected:{id:'christmas'},calendar:{fresh:true},permitted:false});await olderStatus;
assert.equal(eventsController.data.selectedId,'guide:halloween');assert.equal(eventsController.data.selected.name,'Halloween');
assert.equal(eventsController.data.calendar.fresh,true);assert.equal(eventsController.data.permitted,false,'The selection fence must not preserve stale permission data');
const failedStatus=eventsController.load(true);eventReads.at(-1).reject(Error('synthetic calendar failure'));await failedStatus;
assert.equal(eventsController.notice,'synthetic calendar failure');assert.equal(eventsController.busy,false);
const stoppedStatus=eventsController.load(true);eventsController.stopped=true;
const beforeRenders=eventsController.renders,beforeStatusUpdates=eventsController.statusUpdates;
eventReads.at(-1).resolve({selectedId:'christmas'});await stoppedStatus;
assert.equal(eventsController.renders,beforeRenders);assert.equal(eventsController.statusUpdates,beforeStatusUpdates);
console.log('Events controller: selection generation fence, fresh calendar/permissions, duplicate read guard, read failure recovery and stopped UI isolation passed.');

