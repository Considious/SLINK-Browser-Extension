import {readFile,writeFile} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
const argument=process.argv.indexOf('--pda-root'),target=process.argv[argument+1];
if(argument<0||!target||target.startsWith('--'))throw Error('Use --pda-root followed by the SLINK-PDA folder. Add --write to update generated mirrors; otherwise this only checks them.');
const pda=resolve(target),extension=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const manifest=JSON.parse(await readFile(resolve(pda,'source-manifest.json'),'utf8'));
if(manifest.mode!=='direct-source'||!manifest.startupAddons)throw Error('The target is not a recognized SLINK PDA source folder.');
const normalize=text=>text.replace(/\r\n/g,'\n').trimEnd()+'\n';
for(const name of ['faction-node-client.js','faction-node-ui.js','faction-node-settings.js']){
 const source=normalize(await readFile(resolve(extension,'src/core',name),'utf8')),destination=resolve(pda,'src/addons',name);
 if(process.argv.includes('--write'))await writeFile(destination,source,'utf8');
 else if(normalize(await readFile(destination,'utf8'))!==source)throw Error('PDA mirror is stale: '+name);
}
console.log(process.argv.includes('--write')?'Updated three shared Faction Node PDA mirrors.':'All three Faction Node client/UI/settings mirrors match.');
