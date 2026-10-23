import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../src/core/themes.js', import.meta.url), 'utf8');
const shellSource = fs.readFileSync(new URL('../src/content/ui-shell.js', import.meta.url), 'utf8');
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
const asset = name => `https://raw.githubusercontent.com/Considious/SLINK-Cloudflare-Services/main/themes/assets/${name}`;
const gothic = {
  id:'gothic-valentines',
  label:'Gothic Valentines',
  description:'Image-backed steel and roses theme.',
  scope:'slink.theme.gothic-valentines',
  ornament:'gothic',
  swatch:['#09090a','#780d19','#f0e9d9'],
  assets:{
    background:asset('gothic-valentines-background.png'),
    brandIcon:asset('gothic-valentines-rose-icon.png'),
    chatIcon:asset('gothic-valentines-rose-icon.png'),
    frame:asset('gothic-valentines-frame.png'),
    roseCorner:asset('gothic-valentines-rose-corner.png'),
    badgeIvory:asset('gothic-valentines-badge-ivory.svg'),
    panelSmoke:asset('gothic-valentines-panel-smoke.png'),
    panelDamask:asset('gothic-valentines-panel-damask.png'),
    panelCrimson:asset('gothic-valentines-panel-crimson.png'),
    dividerLeft:asset('gothic-valentines-divider-left.png'),
    dividerMiddle:asset('gothic-valentines-divider-middle.png'),
    dividerRight:asset('gothic-valentines-divider-right.png'),
    healthRoses:Object.fromEntries(['100','075','050','025','004'].map(state => [state, asset(`gothic-valentines-roses-${state}.png`)])),
    healthBlood:Object.fromEntries(['100','075','050','025','004'].map(state => [state, asset(`gothic-valentines-blood-${state}.png`)])),
    packaged:true
  },
  tokens:{ '--slink-accent':'#780d19' }
};

themes.installCatalog({ schemaVersion:1, revision:'gothic-test', themes:[fallback, halloween, gothic] });
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
assert.equal(themes.resolve('gothic-valentines', { scopes:['slink.theme.gothic-valentines'] }).ornament, 'gothic');
assert.equal(themes.healthState(76, 100), '100');
assert.equal(themes.healthState(75, 100), '075');
assert.equal(themes.healthState(50, 100), '050');
assert.equal(themes.healthState(5, 100), '025');
assert.equal(themes.healthState(4, 100), '004');
themes.applyHealthToElement(element, gothic, 4, 100);
assert.equal(element.dataset.slinkThemeHealth, '004');
assert.match(element.style.values.get('--slink-theme-health-roses-image'), /chrome-extension:\/\/unit\/assets\/themes\/gothic-valentines-roses-004\.png/);
assert.match(element.style.values.get('--slink-theme-health-blood-image'), /chrome-extension:\/\/unit\/assets\/themes\/gothic-valentines-blood-004\.png/);
themes.installCatalog({ schemaVersion:1, revision:'legacy-worker-test', themes:[fallback, {
  ...gothic,
  ornament:'none',
  assets:{ background:gothic.assets.background, brandIcon:gothic.assets.brandIcon, chatIcon:gothic.assets.chatIcon, packaged:true }
}] });
const recoveredGothic = themes.resolve('gothic-valentines', { scopes:['slink.theme.gothic-valentines'] });
assert.equal(recoveredGothic.ornament, 'gothic');
assert.match(themes.assetVariables(recoveredGothic)['--slink-theme-frame-image'], /gothic-valentines-frame\.png/);
assert.match(themes.assetVariables(recoveredGothic)['--slink-theme-divider-left-image'], /gothic-valentines-divider-left\.png/);
assert.match(themes.healthAssetVariables(recoveredGothic, 50, 100)['--slink-theme-health-roses-image'], /gothic-valentines-roses-050\.png/);
assert.throws(() => themes.validateCatalog({
  schemaVersion:1,
  revision:'bad-asset',
  themes:[fallback, { ...halloween, assets:{ background:'https://evil.test/halloween.jpg' } }]
}), /disallowed/);

assert.match(shellSource, /\.group-tab::before \{ position:absolute;/);
assert.match(shellSource, /\.tab::before \{ position:static; margin-right:1px; transform:none; \}/);
assert.doesNotMatch(shellSource, /\.group-tab::before,:host\(\[data-slink-icon-theme="true"\]\) \.tab::before \{ position:absolute/);
assert.match(shellSource, /data-slink-ornament="gothic"/);
assert.match(shellSource, /opacity:\.68/);
assert.match(shellSource, /window>\.head/);
assert.match(shellSource, /panel-smoke-image/);

console.log('SLINK image theme asset checks passed.');

