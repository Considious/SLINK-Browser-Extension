import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');
const assert = (condition, message) => { if (!condition) throw new Error(message); };
const manifest = JSON.parse(read('manifest.json'));
const scripts = manifest.content_scripts.flatMap(entry => entry.js || []);
const helperIndex = scripts.indexOf('src/core/faction-chat.js');
const firstConsumer = Math.min(...['src/modules/adhd.js', 'src/modules/market.js', 'src/modules/war.js'].map(file => scripts.indexOf(file)));

assert(helperIndex >= 0, 'The shared Faction Chat helper must be loaded.');
assert(helperIndex < firstConsumer, 'The shared Faction Chat helper must load before module consumers.');

for (const file of ['src/modules/adhd.js', 'src/modules/market.js', 'src/modules/war.js']) {
  const source = read(file);
  assert(source.includes('SLINK.core.factionChat.send'), `${file} must use the shared Faction Chat sender.`);
  assert(!/function\s+findFactionChat(?:Container|Launcher|Composer|SendButton)/.test(source), `${file} must not contain a private Faction Chat automation copy.`);
}

console.log('Faction Chat sharing tests passed.');

