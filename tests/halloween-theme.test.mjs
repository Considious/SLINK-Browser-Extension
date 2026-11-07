import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';import vm from 'node:vm';
const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8'),c=vm.createContext({URL,console,chrome:{runtime:{getURL:p=>'chrome-extension://test/'+p}}});c.globalThis=c;
c.SLINK_EXTENSION={core:{permissions:{hasScope:(p,s)=>(p.scopes||[]).some(x=>x===s||x==='admin.*')}},define(g,n,v){(this[g]||={})[n]=v;}};
for(const name of ['christmas-theme','candy-theme','halloween-theme','themes'])vm.runInContext(await read('src/core/'+name+'.js'),c);
const theme=c.SLINK_HALLOWEEN_THEME,t=c.SLINK_EXTENSION.core.themes;
assert.equal(theme.css,await read('assets/themes/halloween-2026-theme.css'));
assert.equal(theme.definition.scope,'slink.theme.halloween');
for(const catalog of [null,{schemaVersion:1,revision:'old',themes:[t.get('slink-dark')]}]){
 if(catalog)t.installCatalog(catalog);
 assert.equal(t.resolve('halloween-2026',{scopes:[]}).id,'slink-dark');
 for(const scope of ['slink.theme.halloween','admin.*'])assert.equal(t.resolve('halloween-2026',{scopes:[scope]}).id,'halloween-2026');
 assert.match(t.get('halloween-2026').assets.frame,/silver-frame-v1/);
}
const stale={...theme.definition,assets:{background:'https://raw.githubusercontent.com/Considious/SLINK-Cloudflare-Services/main/themes/assets/halloween-2026-background.png'}};
t.installCatalog({schemaVersion:1,revision:'stale-halloween',themes:[t.get('slink-dark'),stale]});
assert.match(t.assetVariables(t.get('halloween-2026'))['--slink-theme-frame-image'],/chrome-extension:\/\/test\/assets\/themes\/halloween-2026-silver-frame-v1.webp/);
for(const file of theme.files)assert.ok((await readFile(new URL('../assets/themes/halloween-2026-'+file,import.meta.url))).length>500);
for(const id of ['medicalCooldown','drugCooldown','boosterCooldown','energyRefill','nerveRefill','casinoTokens','playerAddiction','cityItems','landing','racing','education','stockBenefits','organizedCrime','market:1','mission','clusterRing'])assert.ok(theme.alertKind(id));
assert.doesNotMatch(await read('src/core/halloween-theme.js'),/MutationObserver|setInterval|localStorage|fetch\(/);
const manifest=JSON.parse(await read('manifest.json')),pkg=JSON.parse(await read('package.json'));assert.equal(manifest.version,pkg.version);
assert.ok(manifest.content_scripts[0].js.indexOf('src/core/halloween-theme.js')<manifest.content_scripts[0].js.indexOf('src/core/themes.js'));
for(const [file,pattern]of [['src/dashboard/dashboard.html',/halloween-theme\.js/],['src/background/service-worker.js',/halloween-theme\.js/],['src/modules/adhd.js',/SLINK_HALLOWEEN_THEME\?\.refresh/],['src/dashboard/dashboard.js',/SLINK_HALLOWEEN_THEME\?\.refresh/]])assert.match(await read(file),pattern);
console.log('Halloween: exact CSS, unchanged entitlement/admin grants and denial, stale catalogue repair, packaged assets, startup/render hooks and no polling/storage passed.');
