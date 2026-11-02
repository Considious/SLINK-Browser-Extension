import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {fileURLToPath,pathToFileURL} from 'node:url';
const backend=process.env.SLINK_NODE_TEST_ROOT?pathToFileURL(process.env.SLINK_NODE_TEST_ROOT.replace(/[\\/]?$/,'/') ):new URL('../../cloudflare/workers/faction-node/',import.meta.url);
const require=createRequire(new URL('package.json',backend)),{Miniflare}=require('miniflare'),{build}=require('esbuild');
const {sign}=await import(new URL('protocol.js',backend));
const pair=await crypto.subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},true,['sign','verify']),privateKey=await crypto.subtle.exportKey('jwk',pair.privateKey),publicKey=await crypto.subtle.exportKey('jwk',pair.publicKey);
const now=Math.floor(Date.now()/1000),origin='https://node.example.test',issuer='https://central.example.test';
const certificate=await sign({iss:issuer,aud:'slink-node-network',kind:'node_certificate',protocol:1,iat:now,exp:now+86400,node_id:'node',faction_id:10,endpoint:origin,leader_id:1,public_key:publicKey},privateKey);
const bundle=await build({entryPoints:[fileURLToPath(new URL('worker.js',backend))],bundle:true,write:false,format:'esm',platform:'browser',external:['cloudflare:workers']});
const mf=new Miniflare({modules:true,script:bundle.outputFiles[0].text,compatibilityDate:'2026-08-06',durableObjects:{DIRECTORY:{className:'FactionDirectory',useSQLite:true},ROOMS:{className:'ChatRoom',useSQLite:true}},bindings:{SLINK_NODE_ID:'node',SLINK_FACTION_ID:'10',SLINK_CENTRAL_URL:issuer,SLINK_PUBLIC_VERIFY_KEY:JSON.stringify(publicKey),NODE_CERTIFICATE:certificate,NODE_PRIVATE_KEY:JSON.stringify(privateKey)}});
const context=vm.createContext({URL,crypto,AbortSignal,setTimeout,clearTimeout});vm.runInContext(await readFile(new URL('../src/core/faction-node-client.js',import.meta.url),'utf8'),context);
const clients=[];
async function waitFor(predicate){const start=Date.now();while(Date.now()-start<5000){const value=await predicate();if(value)return value;await new Promise(resolve=>setTimeout(resolve,15));}assert.fail('Client/server result was not received.');}
async function client(user,insecure=false){
 const token=await sign({iss:issuer,aud:'node',kind:'chat_access',protocol:1,iat:now,exp:now+300,user_id:user,user_name:'User '+user,faction_id:10,scopes:['slink.chat']},privateKey);
 const instance=context.SLINK_FACTION_NODE.create({ticket:async()=>({token,user_id:user,faction_id:10,node_id:'node',endpoint:origin,expires_at:(now+300)*1000}),members:async()=>({members:[]}),request:async(url,options)=>{const response=await mf.dispatchFetch(url,options),value=await response.json();if(!response.ok)throw Error(value.error);return value;},socket:(url,protocols)=>{
   if(insecure)throw Object.assign(Error('The operation is insecure.'),{name:'SecurityError'});
   let native;const proxy={readyState:0,send:raw=>native.send(raw),close(){proxy.readyState=3;native?.close();}};
   void mf.dispatchFetch(url.replace(/^wss:/,'https:'),{headers:{Upgrade:'websocket','Sec-WebSocket-Protocol':protocols.join(', ')}}).then(response=>{assert.equal(response.status,101);native=response.webSocket;native.addEventListener('message',event=>proxy.onmessage?.(event));native.addEventListener('close',event=>{proxy.readyState=3;proxy.onclose?.(event);});proxy.readyState=1;native.accept();}).catch(error=>{proxy.onerror?.(error);proxy.onclose?.({code:1011});});return proxy;
 }});clients.push(instance);instance.setActive(true);await instance.refresh();return instance;
}
try{
 const leader=await client(1),member=await client(2);assert.equal(leader.model.leader,true);assert.equal(member.model.leader,false);
 await member.connect('general');await waitFor(()=>member.room('general').status==='connected');
 member.send('general',{type:'text',text:'Round-trip through the real room'});await waitFor(()=>member.room('general').messages.size===1&&member.room('general').pending.size===0);
 const message=[...member.room('general').messages.values()][0];await member.action('general',{type:'edit',message_id:message.message_id,content:{type:'text',text:'Confirmed edit'}});assert.equal(member.room('general').messages.get(message.message_id).content.text,'Confirmed edit');
 await leader.api('/api/admin',{action:'member.set',room_id:'general',user_id:2,muted:true,muted_until:Date.now()+1000});await waitFor(()=>member.room('general').access.speak===false);assert.throws(()=>member.send('general',{type:'text',text:'Must not send'}),/not ready/);
 await waitFor(()=>member.room('general').access.speak===true);member.setActive(false);assert.equal(member.room('general').messages.size,1);member.setActive(true);await waitFor(()=>member.room('general').status==='connected');assert.equal(member.room('general').messages.size,1);
 await member.action('general',{type:'delete',message_id:message.message_id});assert.ok(member.room('general').messages.get(message.message_id).deleted_at);
 await leader.api('/api/admin',{action:'member.set',room_id:'general',user_id:2,blocked:true});await waitFor(()=>member.room('general').access.read===false);
 const iphone=await client(3,true);await iphone.connect('general');assert.equal(iphone.room('general').status,'connected');assert.equal(iphone.room('general').access.speak,true);
 iphone.send('general',{type:'text',text:'HTTPS fallback round-trip'});await waitFor(()=>iphone.room('general').pending.size===0&&[...iphone.room('general').messages.values()].some(message=>message.content?.text==='HTTPS fallback round-trip'));
 const httpMessage=[...iphone.room('general').messages.values()].find(message=>message.content?.text==='HTTPS fallback round-trip');
 await iphone.action('general',{type:'edit',message_id:httpMessage.message_id,content:{type:'text',text:'HTTPS edit'}});assert.equal(iphone.room('general').messages.get(httpMessage.message_id).content.text,'HTTPS edit');
 await iphone.action('general',{type:'delete',message_id:httpMessage.message_id});assert(iphone.room('general').messages.get(httpMessage.message_id).deleted_at);
 await leader.api('/api/admin',{action:'member.set',room_id:'general',user_id:3,muted:true});await iphone.connect('general',true);assert.equal(iphone.room('general').access.speak,false);assert.throws(()=>iphone.send('general',{type:'text',text:'No bypass'}),/not ready/);
 console.log('Real client/server round-trip passed: Leader/member discovery, socket history, send/ack, edit/delete, timed mute, pause/resume without duplicates, and access revocation.');
}finally{for(const client of clients)client.dispose();await mf.dispose();}
