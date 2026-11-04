import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const read = path => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
class FakeNode {
  constructor(tag = 'div') { this.tagName = tag; this.children = []; this.listeners = {}; this.dataset = {}; this.style={}; this.className = ''; this.textContent = ''; this.disabled = false; this.isConnected = true; }
  setAttribute(name,value){this[name]=value;}
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
const api = { core:{ format:{errorMessage:error=>error.message}, factionChat:{ isPrimed:()=>false } }, define(group,key,value){this[group][key]=value;}, modules:{ definitions:new Map(), register(definition){ this.definitions.set(definition.id,definition); } }, services:{} };
api.core.messaging = { send:async name=>{ calls.push(name); return name==='adhd.status'||name==='adhd.refresh' ? status : {}; } };
const context = vm.createContext({
  console, URL, setTimeout, clearTimeout, setInterval:()=>1, clearInterval(){},
  addEventListener(){}, removeEventListener(){},
  document:{ createElement:tag=>new FakeNode(tag), createTextNode:text=>Object.assign(new FakeNode('#text'),{textContent:text}) },
  SLINK_EXTENSION:api
});
context.globalThis = context;
vm.runInContext(read('src/core/adhd.js'), context);
api.core.adhd={...api.core.adhd,reminderControls:()=>new FakeNode('reminders'),updateReminderClock(){}};
vm.runInContext(read('src/modules/adhd.js'), context);
const ui = {
  setModuleStyles(){}, getContentElement:()=>root, setThemeHealth(){}, setAlertCount(){}, setStatus(){},
  setBubbleAlert(){}, setActions(actions){ this.actions=actions; }
};
const controller = await api.modules.definitions.get('adhd').start({ ui, signal:{aborted:false} });
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
const ring={id:'clusterRing',clusterRingAvailable:true};
const common=[{id:'medicalCooldown'},{id:'arsonUnique'},{id:'clusterRing',clusterRingAvailable:false}];
assert.equal(api.core.adhd.alertsForView(common).map(row=>row.id).join(','),'medicalCooldown');
assert.equal(api.core.adhd.alertsForView(common,true).map(row=>row.id).join(','),'arsonUnique,clusterRing');
assert.equal(api.core.adhd.alertsForView([ring])[0].title,'Cluster Ring opportunity');
assert.equal(api.core.adhd.alertsForView([ring],true)[0],ring);
status.activeAlerts=[{id:'arsonUnique',title:'Arson reminder',links:[]},{id:'searchCashUnique',title:'Search reminder',links:[]}];
const crimeController=await api.modules.definitions.get('crimes').start({ui,signal:{aborted:false}});
const content=node=>[node.textContent,...node.children.map(content)].join(' ');
assert.match(content(root),/Search reminder/);
assert.doesNotMatch(content(root),/Arson reminder/);
findButton(root,'Arson').onclick();
assert.match(content(root),/Arson reminder/);
assert.doesNotMatch(content(root),/Search reminder/);
crimeController.stop();

console.log('Torn Efficiency retains alert controls across an unchanged periodic refresh.');
