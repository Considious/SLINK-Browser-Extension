// Build the attributed Torn Rooms UI adaptation; no upstream backend is bundled.
import {readFile,writeFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {fileURLToPath,pathToFileURL} from 'node:url';
import path from 'node:path';
const root=fileURLToPath(new URL('../',import.meta.url));
const require=createRequire(import.meta.url);
const esbuild=await import(process.env.SLINK_ESBUILD_PACKAGE?pathToFileURL(process.env.SLINK_ESBUILD_PACKAGE).href:require.resolve('esbuild'));
const result=await esbuild.build({entryPoints:[path.join(root,'src/rooms-ui/runtime.ts')],bundle:true,write:false,format:'iife',globalName:'SLINK_TORN_ROOMS_UI',platform:'browser',target:'es2020',loader:{'.css':'text'},legalComments:'inline',minify:false,footer:{js:'globalThis.SLINK_TORN_ROOMS_UI=SLINK_TORN_ROOMS_UI;'}});
const credit='/* Torn Rooms UI adapted from Manuel [3747263] / Manuel Cecchetto, MIT.\n * https://github.com/manuelcecchetto/torn-rooms at 6dd9f46fa422f4a5da12dfe34465dd87242722e3.\n * See vendor/torn-rooms/LICENSE. Torn-derived generated styles/icons remain TORN LTD property.\n * Built by tools/build-room-ui.mjs. SLINK backend, auth, storage and permissions remain independent. */\n';
const license='/* '+(await readFile(path.join(root,'vendor/torn-rooms/LICENSE'),'utf8')).trim()+' */\n';
const source=credit+license+result.outputFiles[0].text+'\n'+await readFile(path.join(root,'src/rooms-ui/bridge.js'),'utf8');
const targets=[path.join(root,'src/core/faction-node-ui.js'),path.resolve(root,'../SLINK-PDA/src/addons/faction-node-ui.js')];
for(const target of targets){if(process.argv.includes('--check')){if(await readFile(target,'utf8')!==source)throw Error('Rebuild Rooms UI: '+target);}else await writeFile(target,source,'utf8');}
console.log('Attributed Torn Rooms UI '+(process.argv.includes('--check')?'verified':'built')+' for extension and PDA ('+Buffer.byteLength(source)+' bytes).');
