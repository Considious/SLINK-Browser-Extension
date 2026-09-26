import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');
const assert = (condition, message) => { if (!condition) throw new Error(message); };
const manifest = JSON.parse(read('manifest.json'));
const scripts = manifest.content_scripts.flatMap(entry => entry.js || []);
const helperIndex = scripts.indexOf('src/core/faction-chat.js');
const consumers = ['src/modules/adhd.js', 'src/modules/market.js', 'src/modules/war.js'];
const firstConsumer = Math.min(...consumers.map(file => scripts.indexOf(file)));

assert(helperIndex >= 0, 'The shared Faction Chat helper must be loaded.');
assert(helperIndex < firstConsumer, 'The shared Faction Chat helper must load before module consumers.');

for (const file of consumers) {
  const source = read(file);
  assert(source.includes('SLINK.core.factionChat.send'), file + ' must use the shared Faction Chat sender.');
  assert(!/function\s+findFactionChat(?:Container|Launcher|Composer|SendButton)/.test(source), file + ' must not contain a private Faction Chat automation copy.');
}

const helperSource = read('src/core/faction-chat.js');
assert(helperSource.includes("M18,0l-4.5,16.5-6.1-5.43"), 'The sender must identify the Torn paper-plane icon.');
assert(!helperSource.includes("parentElement?.querySelector('button')"), 'The sender must never accept the first nearby button.');
assert(helperSource.includes('sendInFlight'), 'The sender must prevent duplicate concurrent sends.');

let historyClicks = 0;
let sendClicks = 0;
let sendButton;

class FakeEvent {
  constructor(type) { this.type = type; }
}
class FakeInputEvent extends FakeEvent {}
class FakeTextArea {
  constructor() {
    this.tagName = 'TEXTAREA';
    this._value = '';
    this.parentElement = null;
  }
  get value() { return this._value; }
  set value(next) { this._value = String(next); }
  focus() {}
  matches(selector) { return selector === 'textarea,input'; }
  dispatchEvent(event) {
    if (event.type === 'input') sendButton.disabled = false;
    return true;
  }
}

const historyButton = {
  type:'button',
  disabled:false,
  textContent:'',
  getAttribute() { return null; },
  querySelector() { return null; },
  click() { historyClicks += 1; }
};
const sendPath = {
  getAttribute(name) {
    return name === 'd'
      ? 'M18,0l-4.5,16.5-6.1-5.43,5.86-6.17-7.84,5.42-5.41-1.32L18,0ZM6.75,12.5v5.5l2.44-3.32-2.44-2.18Z'
      : null;
  }
};
const composer = new FakeTextArea();
sendButton = {
  type:'button',
  disabled:true,
  textContent:'',
  getAttribute(name) { return name === 'aria-disabled' ? String(this.disabled) : null; },
  querySelector(selector) { return selector === 'svg[viewBox="0 0 18 18"] path' ? sendPath : null; },
  click() {
    sendClicks += 1;
    setTimeout(() => { composer.value = ''; }, 25);
  }
};
const composerRow = {
  querySelectorAll() { return [historyButton, sendButton]; }
};
composer.parentElement = composerRow;
const container = {
  querySelector(selector) { return selector.includes('textarea') ? composer : null; },
  querySelectorAll() { return [historyButton, sendButton]; }
};
const document = {
  visibilityState:'visible',
  hasFocus:() => true,
  querySelectorAll(selector) {
    if (selector === '[id^="faction-"]') return [container];
    return [];
  },
  execCommand() { return false; }
};
const modules = {};
const context = {
  console,
  document,
  Event:FakeEvent,
  InputEvent:FakeInputEvent,
  HTMLTextAreaElement:FakeTextArea,
  HTMLInputElement:FakeTextArea,
  setTimeout,
  clearTimeout,
  SLINK_EXTENSION:{
    define(namespace, name, value) {
      modules[namespace] ||= {};
      modules[namespace][name] = value;
    }
  }
};
vm.runInNewContext(helperSource, context, { filename:'faction-chat.js' });
const [first, duplicate] = await Promise.all([
  modules.core.factionChat.send('RETAL test'),
  modules.core.factionChat.send('RETAL duplicate')
]);

assert(first.ok, 'The real paper-plane button should send successfully.');
assert(!duplicate.ok, 'A concurrent duplicate send must be rejected.');
assert(sendClicks === 1, 'The paper-plane button must be clicked exactly once.');
assert(historyClicks === 0, 'The chat-history button must never be clicked.');

const marketSource = read('src/modules/market.js');
assert(!/\bif\s*\(\s*sent\s*\)/.test(marketSource), 'Market Watch must use result.ok after the shared sender returns.');

console.log('Faction Chat sharing tests passed.');
