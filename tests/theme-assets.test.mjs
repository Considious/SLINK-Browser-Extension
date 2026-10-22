import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../src/core/themes.js', import.meta.url), 'utf8');
const context = {
  URL,
  chrome:{ runtime:{ getURL:path => `chrome-extension://unit/${path}` } },
  console
};
context.globalThis = context;
context.SLINK_EXTENSION = {
  core:{ permissions:{ hasScope:(snapshot, required) => (snapshot?.scopes || []).some(scope => scope === required || scope === 'admin.*') } },
  define(group, name, value) {
    this[group] ||= {};
    this[group][name] = value;
  }
};
vm.runInNewContext(source, context, { filename:'themes.js' });

const themes = context.SLINK_EXTENSION.core.themes;
const fallback = {
  id:'slink-dark',
  label:'SLINK Dark',
  description:'Free fallback.',
  scope:null,
  ornament:'none',
  swatch:['#112233','#445566','#778899'],
  tokens:{ '--slink-bg':'#112233' }
};
const halloween = {
  id:'halloween-2026',
  label:'Halloween 2026',
  description:'Image-backed seasonal theme.',
  scope:'slink.theme.halloween',
  ornament:'halloween',
  swatch:['#08050f','#a72cff','#75ff42'],
  assets:{
    background:'https://raw.githubusercontent.com/Considious/SLINK-Cloudflare-Services/main/themes/assets/halloween-2026-background.png',
    iconSheet:'https://raw.githubusercontent.com/Considious/SLINK-Cloudflare-Services/main/themes/assets/halloween-2026-icons.png',
    packaged:false
  },
  tokens:{ '--slink-accent':'#a72cff' }
};

themes.installCatalog({ schemaVersion:1, revision:'halloween-test', themes:[fallback, halloween] });
assert.equal(themes.resolve('halloween-2026', { scopes:[] }).id, 'slink-dark');
assert.equal(themes.resolve('halloween-2026', { scopes:['slink.theme.halloween'] }).id, 'halloween-2026');
assert.equal(themes.resolve('halloween-2026', { scopes:['admin.*'] }).id, 'halloween-2026');
const css = themes.cssVariables('halloween-2026', { scopes:['slink.theme.halloween'] });
assert.match(css, /chrome-extension:\/\/unit\/assets\/themes\/halloween-2026-background\.png/);
assert.doesNotMatch(css, /raw\.githubusercontent\.com/);
assert.match(css, /--slink-theme-icon-sheet:url/);
const element = { dataset:{}, style:{ values:new Map(), setProperty(name, value) { this.values.set(name, value); } } };
themes.applyToElement(element, 'halloween-2026', { scopes:['slink.theme.halloween'] });
assert.equal(element.dataset.slinkImageTheme, 'true');
assert.equal(element.dataset.slinkIconTheme, 'true');
assert.equal(themes.normalizePanelOpacity(-20), 0);
assert.equal(themes.normalizePanelOpacity(150), 100);
assert.equal(themes.applyPanelOpacity(element, 0), 0);
assert.equal(element.style.values.get('--slink-theme-panel-opacity'), '0%');
assert.equal(element.style.values.get('--slink-theme-panel-blur'), '0.00px');
assert.equal(element.style.values.get('--slink-theme-veil-top'), '0.00%');
assert.throws(() => themes.validateCatalog({
  schemaVersion:1,
  revision:'bad-asset',
  themes:[fallback, { ...halloween, assets:{ background:'https://evil.test/halloween.jpg' } }]
}), /disallowed/);

console.log('SLINK Halloween 2026 theme asset checks passed.');

