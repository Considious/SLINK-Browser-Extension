import {readFile,writeFile,copyFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
// Run from the extension checkout, passing the Torn-Scripts/SLINK-PDA checkout.
const target=process.argv[2];if(!target)throw Error('Usage: node tools/sync-kal.mjs PATH_TO_TORN_SCRIPTS/SLINK-PDA');
const root=resolve(target);
if(JSON.parse(await readFile(join(root,'source-manifest.json'),'utf8')).mode!=='direct-source')throw Error('Expected the SLINK PDA source checkout.');
for(const name of ['kal','kal-ui'])await writeFile(join(root,'src/addons/'+name+'.js'),await readFile('src/core/'+name+'.js','utf8'));
await copyFile('docs/KAL-INTEGRATION.md',join(root,'KAL-INTEGRATION.md'));
console.log('Shared KAL modules synchronized. Run PDA build.mjs --write and the KAL tests in both checkouts.');
