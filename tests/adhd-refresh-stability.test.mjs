import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const read = path => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
class FakeNode {
  constructor(tag = 'div') { this.tagName = tag; this.children = []; this.listeners = {}; this.dataset = {}; this.className = ''; this.textContent = ''; this.disabled = false; this.isConnected = true; }
  append(...nodes) { this.children.push(...nodes); }
  replaceChildren(...nodes) { this.children = nodes; }
  addEventListener(type, callback) { this.listeners[type] = callback; }
  querySelectorAll(selector) {
    const all = [];
    const walk = node => { for (const child of node.children || []) { if (selector === 'strong' && child.tagName === 'strong') all.push(child); walk(child); } };
    walk(this); return all;
  }
  querySelector(selector) {
    if (selector === '.slink-adhd-summary') return this.children.find(child => child.className === selector.slice(1)) || null;
    return null;
  }
}
const root = new FakeNode('root');
const calls = [];
const status = {
  activeAlerts: [{ id:'medicalCooldown', title:'Medical cooldown', detail:'2h remaining', tone:'ready', links:[] }],
  settings: { soundEnabled:{}, enabled:{}, snoozedUntil:{}, soundChoice:'chime' },
  city:{ bought:0 }, configured:true, fetchedAt:1000, tornApiUsage:{ count:3, limit:60 }
};
const api = { core:{ adhD:null, adhd:{ ALERT_SCOPE:'slink.adhd.alerts', normalizeSettings:value=>({ ...value, soundEnabled:value.soundEnabled||{}, enabled:value.enabled||{} }), reminderControls:()=>new FakeNode('reminders'), updateReminderClock(){} }, factionChat:{ isPrimed:()=>false } }, modules:{ register(definition){ this.definition=definition; } }, services:{} };
api.core.messaging = { send:async name=>{ calls.push(name); return name==='adhd.status'||name==='adhd.refresh' ? status : {}; } };
const context = vm.createContext({
  console, URL, setTimeout, clearTimeout, setInterval:()=>1, clearInterval(){},
  addEventListener(){}, removeEventListener(){},
  document:{ createElement:tag=>new FakeNode(tag), createTextNode:text=>Object.assign(new FakeNode('#text'),{textContent:text}) },
  SLINK_EXTENSION:api
});
context.globalThis = context;
vm.runInContext(read('src/modules/adhd.js'), context);
const ui = {
  setModuleStyles(){}, getContentElement:()=>root, setThemeHealth(){}, setAlertCount(){}, setStatus(){},
  setBubbleAlert(){}, setActions(actions){ this.actions=actions; }
};
const controller = await api.modules.definition.start({ ui, signal:{aborted:false} });
const findButton = (node, text) => {
  if (node.tagName === 'button' && node.textContent === text) return node;
  for (const child of node.children || []) { const found = findButton(child, text); if (found) return found; }
  return null;
};
const snooze = findButton(root, 'Snooze 5m');
assert.ok(snooze, 'Initial render should expose the snooze action.');
const initialReplaceCount = root.children.length;
await ui.actions.find(action => action.id === 'refresh').onClick({ currentTarget:new FakeNode('button') });
assert.equal(root.children.length, initialReplaceCount, 'An unchanged timer refresh must not replace the existing alert panel.');
assert.equal(findButton(root, 'Snooze 5m'), snooze, 'The in-place alert action must retain its DOM identity across an unchanged refresh.');
assert.equal(calls.filter(name => name === 'adhd.status' || name === 'adhd.refresh').length, 2);
controller.stop();

console.log('Torn Efficiency retains alert controls across an unchanged periodic refresh.');
