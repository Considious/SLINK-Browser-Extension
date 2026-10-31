import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const read = path => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const context = vm.createContext({ console, structuredClone, URL, setTimeout, clearTimeout });
for (const file of ['runtime', 'permissions', 'adhd', 'faction-officers']) {
  vm.runInContext(read(`src/core/${file}.js`), context);
}
const api = context.SLINK_EXTENSION;
const values = new Map();
let scopes = [];
const setScopes = value => { scopes = value; values.set('permissions.snapshot', { scopes }); };
api.core.storage = {
  get: async (key, fallback) => structuredClone(values.has(key) ? values.get(key) : fallback),
  set: async (key, value) => { values.set(key, structuredClone(value)); }
};
api.services.permissionAccess = {
  settings: async () => ({}),
  ensureSession: async (_refresh, required) => {
    if (!api.core.permissions.hasScope({ scopes }, required)) throw Error(`Missing SLINK permission: ${required}`);
    return { token: 'test-session' };
  }
};
api.core.http = { requestJson: async () => ({ alerts: [] }) };
api.core.tornApiLimiter = { reserve: async () => {} };
vm.runInContext(read('src/background/faction-officer-service.js'), context);
const service = api.services.factionOfficer;
const row = { user_id: 42, user_name: 'New member', joined_at: 1234, level: 12, position: 'Recruit' };
values.set('faction.onboarding.runtime.v1', { alerts: [row], nextRefreshAt: Date.now() + 60_000 });
values.set('adhd.settings.v1', { enabled: { factionOnboarding: true }, snoozedUntil: {} });

setScopes([]);
assert.equal((await service.activeAlerts(false)).filter(alert => alert.kind === 'faction-onboarding').length, 0,
  'Cached onboarding intelligence must not be visible without officer/admin permission.');

setScopes(['slink.war.officer']);
let alerts = await service.activeAlerts(false);
assert.equal(alerts.filter(alert => alert.kind === 'faction-onboarding').length, 1,
  'An authorized officer should see an unverified new-member reminder.');
assert.match(alerts.find(alert => alert.kind === 'faction-onboarding').detail, /proficiency weapon/);
assert.match(alerts.find(alert => alert.kind === 'faction-onboarding').detail, /4 Xanax only if stacking and still recruit/);

values.set('adhd.settings.v1', { enabled: { factionOnboarding: true }, snoozedUntil: { 'factionOnboarding:42:1234': Date.now() + 60_000 } });
alerts = await service.activeAlerts(false);
assert.equal(alerts.some(alert => alert.kind === 'faction-onboarding'), false,
  'A snoozed onboarding reminder must be omitted from the alert list.');

values.set('adhd.settings.v1', { enabled: { factionOnboarding: true }, snoozedUntil: {} });
values.set('faction.onboarding.runtime.v1', { alerts: [{ ...row, officer_verified_at: 5678 }], nextRefreshAt: Date.now() + 60_000 });
alerts = await service.activeAlerts(false);
assert.equal(alerts.some(alert => alert.kind === 'faction-onboarding'), false,
  'Officer-verified members should leave non-admin officer alert queues.');
setScopes(['admin.*']);
alerts = await service.activeAlerts(false);
const adminAlert = alerts.find(alert => alert.kind === 'faction-onboarding');
assert.ok(adminAlert, 'Admin should retain officer-verified members for the separate admin verification step.');
assert.equal(adminAlert.viewerIsAdmin, true);
assert.match(adminAlert.detail, /Officer verified; awaiting admin confirmation/);

setScopes([]);
await assert.rejects(service.routes['faction.onboarding.dismiss']({ memberId: 42, joinedAt: 1234 }), /Missing SLINK permission/,
  'Dismissal must enforce officer access rather than being a local permission bypass.');
setScopes(['slink.war.officer']);
await service.routes['faction.onboarding.dismiss']({ memberId: 42, joinedAt: 1234 });
alerts = await service.activeAlerts(false);
assert.equal(alerts.some(alert => alert.kind === 'faction-onboarding'), false,
  'A locally dismissed join should stay hidden for that join timestamp.');
values.set('faction.onboarding.runtime.v1', { alerts: [{ ...row, joined_at: 1235 }], nextRefreshAt: Date.now() + 60_000 });
alerts = await service.activeAlerts(false);
assert.equal(alerts.filter(alert => alert.kind === 'faction-onboarding').length, 1,
  'Dismissing one join must not suppress a later rejoin by the same member.');

console.log('Faction onboarding alert access, snoozes, verified-admin visibility, and authorized dismissals passed.');
