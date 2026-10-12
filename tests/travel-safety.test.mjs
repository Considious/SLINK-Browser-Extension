import fs from 'node:fs';
import vm from 'node:vm';

const definitions = {};
const sandbox = {
  console,
  Intl,
  URL,
  Date,
  globalThis:null,
  SLINK_EXTENSION:{ define(group, name, value) { definitions[`${group}.${name}`] = value; this[group] ||= {}; this[group][name] = value; } }
};
sandbox.globalThis = sandbox;
vm.runInNewContext(fs.readFileSync(new URL('./core-travel-safety.js', import.meta.url), 'utf8'), sandbox);
const travel = sandbox.SLINK_EXTENSION.core.travelSafety;
const assert = (condition, message) => { if (!condition) throw new Error(message); };

assert(travel.parseDurationMs('0h 27m') === 27 * 60_000, 'Torn datetime was not parsed.');
assert(travel.parseDurationMs('27 minutes') === 27 * 60_000, 'Accessible duration was not parsed.');
assert(travel.parseDurationMs('00:27') === 27 * 60_000, 'Visible minute clock was not parsed.');
assert(travel.roundTripMs(27 * 60_000) === Math.ceil(27 * 60_000 * 2.2), 'Round trip did not include the 10% buffer.');
assert(travel.destinationFromLabel('Travel to Cayman Islands') === 'Cayman Islands', 'Destination label was not normalized.');
const now = 1_800_000_000_000;
const crime = travel.normalizeCrime({ organizedcrime:{ id:7, name:'Planning', ready_at:(now + 50 * 60_000) / 1000 } });
assert(crime.readyAt === now + 50 * 60_000, 'Crime ready_at seconds were not normalized.');
assert(travel.assessTrip({ now, oneWayMs:27 * 60_000, crime }).blocked, 'A late return was not blocked.');
assert(!travel.assessTrip({ now, oneWayMs:20 * 60_000, crime }).blocked, 'A safe return was blocked.');
assert(!travel.assessTrip({ now, oneWayMs:27 * 60_000, crime:null }).blocked, 'Missing crime data blocked travel.');
console.log('Travel safety tests passed.');

