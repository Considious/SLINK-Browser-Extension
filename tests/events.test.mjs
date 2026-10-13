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
console.log('SLINK Events tests passed.');
