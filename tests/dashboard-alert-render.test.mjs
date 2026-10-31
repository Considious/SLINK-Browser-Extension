import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../src/dashboard/dashboard.js', import.meta.url), 'utf8');
const helpers = source.slice(source.indexOf('  function markAdhdSettingDirty'), source.indexOf('  function renderAdhd()'));
class FakeNode {
  constructor() { this.children = []; this.dataset = {}; this.listeners = {}; this.replaceCount = 0; this.checked = false; this.disabled = false; this.type = ''; }
  append(...items) { this.children.push(...items); }
  replaceChildren(...items) { this.replaceCount++; this.children = items; }
  addEventListener(name, callback) { this.listeners[name] = callback; }
}
const elements = new Map();
const context = vm.createContext({
  document: { createElement: () => new FakeNode() },
  byId: id => elements.get(id),
  adhd: { crimeUniques: [] },
  adhdSettingsDirty: new Set(),
  setBusy: () => {},
  errorText: error => error.message
});
vm.runInContext(helpers, context);
const container = new FakeNode();
const settings = { enabled: { alpha: true, beta: false }, soundEnabled: { alpha: false, beta: true }, cityStockAlerts: {}, openLinksInNewTab: false };
const definitions = [{ id: 'alpha', label: 'Alpha', mode: 'live' }, { id: 'beta', label: 'Beta', mode: 'live' }];
context.renderAdhdToggleRows(container, definitions, settings, 'alert');
const firstInput = container.children[0].children[1];
const secondInput = container.children[1].children[1];
assert.equal(firstInput.checked, true);
assert.equal(secondInput.checked, false);
firstInput.checked = false;
firstInput.listeners.change();
context.renderAdhdToggleRows(container, definitions, { ...settings, enabled: { alpha: true, beta: true } }, 'alert');
assert.equal(container.replaceCount, 1, 'A status refresh must keep the existing alert-toggle nodes in place.');
assert.equal(container.children[0].children[1], firstInput, 'Refresh must not replace the checkbox the user was interacting with.');
assert.equal(firstInput.checked, false, 'A user-edited checkbox must not be overwritten by a status refresh.');
assert.equal(secondInput.checked, true, 'Untouched checkboxes should follow the latest saved settings.');

const input = new FakeNode(); input.value = 'edited';
elements.set('draft-field', input);
context.adhdSettingsDirty.add('draft-field');
context.setAdhdControl('draft-field', 'server-value');
assert.equal(input.value, 'edited', 'Uncommitted input text must survive unrelated renders.');

const status = new FakeNode(); elements.set('adhd-settings-message', status);
await context.runAdhdAction(new FakeNode(), async () => { throw Error('permission denied'); });
assert.equal(status.textContent, 'permission denied', 'Failed alert actions should show a recoverable message.');

console.log('Dashboard alert refreshes preserve dirty inputs and checkbox nodes; failed alert actions show an error.');
