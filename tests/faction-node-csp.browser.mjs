import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,dirname,basename,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
const {chromium}=await import(process.env.SLINK_BROWSER_PACKAGE?pathToFileURL(process.env.SLINK_BROWSER_PACKAGE).href:'playwright');
const temp=await mkdtemp(join(tmpdir(),'slink-node-csp-')),extension=join(temp,'extension'),profile=join(temp,'profile');
await mkdir(extension);
let observedOrigin=null,context;
const server=createServer((_request,response)=>{response.setHeader('Content-Security-Policy',"default-src 'none'; script-src 'none'; connect-src 'none'");response.setHeader('Content-Type','text/html');response.end('<!doctype html><title>Isolated content script test</title><p>Synthetic test page</p>');});
server.on('upgrade',(request,socket)=>{observedOrigin=request.headers.origin;socket.end('HTTP/1.1 400 Test complete\r\nConnection: close\r\n\r\n');});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const origin='http://127.0.0.1:'+server.address().port;
try{
 await writeFile(join(extension,'manifest.json'),JSON.stringify({manifest_version:3,name:'SLINK isolated socket test fixture',version:'1.0',content_scripts:[{matches:['http://127.0.0.1/*'],js:['probe.js'],world:'ISOLATED',run_at:'document_idle'}]}));
 await writeFile(join(extension,'probe.js'),`document.documentElement.dataset.slinkIsolationProbe='loaded';new WebSocket(${JSON.stringify(origin.replace('http:','ws:')+'/probe')});`);
 context=await chromium.launchPersistentContext(profile,{headless:true,ignoreDefaultArgs:['--disable-extensions'],...(process.env.SLINK_BROWSER_EXECUTABLE?{executablePath:process.env.SLINK_BROWSER_EXECUTABLE}:{}),args:['--disable-extensions-except='+extension,'--load-extension='+extension]});
 const page=await context.newPage();await page.goto(origin);await page.waitForFunction(()=>document.documentElement.dataset.slinkIsolationProbe==='loaded',null,{timeout:5000});
 const started=Date.now();while(!observedOrigin&&Date.now()-started<3000)await new Promise(resolve=>setTimeout(resolve,20));
 assert.equal(observedOrigin,origin,'The isolated socket should connect despite page connect-src:none and use the page origin expected by the node allowlist.');
 console.log('Real isolated extension content-script check passed: strict page CSP did not block the socket, and its Origin matches the page origin.');
}catch(error){console.error('Isolated content-script test:',error.message);throw error;}finally{
 await context?.close();await new Promise(resolve=>server.close(resolve));
 assert.equal(resolve(dirname(temp)),resolve(tmpdir()));assert.ok(basename(temp).startsWith('slink-node-csp-'));try{await rm(temp,{recursive:true,force:true,maxRetries:3,retryDelay:100});}catch(error){console.warn('Temporary test profile could not be fully removed:',error.code);}
}
