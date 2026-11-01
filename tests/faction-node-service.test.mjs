import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const source=await readFile(new URL('../src/background/faction-node-service.js',import.meta.url),'utf8');
const client=await readFile(new URL('../src/core/faction-node-client.js',import.meta.url),'utf8');
function fixture(){
 const values=new Map([['access.settings.v1',{tornKey:'synthetic-test-key'}],['access.acceptedTerms.v1',{version:'terms-v1',sha256:'terms-hash'}],['access.session.v1',{token:'production-session-untouched'}],['permissions.access',{scopes:['production-scope']}]]),calls=[],auth=[];let failures=0,reserved=0;
 const extension={services:{permissionAccess:{ensureSession:async()=>{auth.push('must-not-be-used');throw Error('Production authentication was touched');}}},core:{storage:{get:async(key,fallback)=>values.get(key)||fallback,set:async(key,value)=>{values.set(key,value);return value;}},tornApiLimiter:{reserve:async()=>{reserved++;}},http:{requestJson:async(provider,url,options={})=>{calls.push({provider,url,options});if(url.endsWith('/api/chat/token')&&failures-->0){const error=Error('Refresh membership');error.status=428;throw error;}if(url.endsWith('/terms'))return {terms:{version:'terms-v1',sha256:'terms-hash'}};if(url.endsWith('/auth')){const now=Math.floor(Date.now()/1000);return {session_token:'test-permission-token',user_id:1,faction_id:46978,scopes:['slink.chat'],iat:now,expires_at:new Date((now+7200)*1000).toISOString()};}return {token:'chat-token',endpoint:'https://slink-faction-node-46978-test.richard-johnson554.workers.dev',members:[]};}}},define(group,name,value){this[group][name]=value;}};
 const context=vm.createContext({SLINK_EXTENSION:extension,crypto,TextEncoder,URL,Date});vm.runInContext(client,context);vm.runInContext(source,context);
 return {routes:extension.services.factionNode.routes,values,calls,auth,get reserved(){return reserved;},set failures(value){failures=value;}};
}
test('new chat stays off by default and its setting is isolated from existing preferences',async()=>{
 const f=fixture();f.values.set('chat.settings.v1',{ffBubbles:true});assert.equal((await f.routes['factionNode.settings.get']()).enabled,false);assert.equal(f.calls.length,0);
 await f.routes['factionNode.settings.patch']({enabled:true});assert.equal(f.values.get('chat.settings.v1').ffBubbles,true);assert.equal(f.calls.length,0);
 await assert.rejects(f.routes['factionNode.settings.patch']({enabled:true,clearEverything:true}));
});
test('test chat uses an isolated session and sends the saved key only to test Central, never the customer node',async()=>{
 const f=fixture();await f.routes['factionNode.settings.patch']({enabled:true});await Promise.all([f.routes['factionNode.ticket']({}),f.routes['factionNode.ticket']({})]);assert.equal(f.calls.length,3);assert.equal(f.auth.length,0);assert.equal(f.reserved,1);
 const login=f.calls.find(c=>c.url.endsWith('/auth')),ticket=f.calls.find(c=>c.url.endsWith('/api/chat/token'));assert.equal(JSON.parse(login.options.body).api_key,'synthetic-test-key');assert.equal(ticket.options.headers.Authorization,'Bearer test-permission-token');assert.equal(ticket.options.body,'{}');assert.ok(f.calls.every(c=>c.provider==='factionChatTest'&&c.url.startsWith('https://slink-chat-central-test.richard-johnson554.workers.dev/')));assert.equal(f.values.get('access.session.v1').token,'production-session-untouched');assert.deepEqual(f.values.get('permissions.access').scopes,['production-scope']);
});
test('stale identity refreshes once and repeated failure does not loop',async()=>{
 const f=fixture();await f.routes['factionNode.settings.patch']({enabled:true});f.failures=2;await assert.rejects(f.routes['factionNode.ticket']({}));assert.equal(f.calls.filter(c=>c.url.endsWith('/api/chat/token')).length,2);assert.equal(f.calls.filter(c=>c.url.endsWith('/auth')).length,2);assert.equal(f.values.get('access.session.v1').token,'production-session-untouched');
});

test('disabled rooms and missing terms acceptance cannot trigger a test-key authentication',async()=>{
 const f=fixture();await assert.rejects(f.routes['factionNode.ticket']({}),/Enable Faction Rooms/);assert.equal(f.calls.length,0);await f.routes['factionNode.settings.patch']({enabled:true});f.values.delete('access.acceptedTerms.v1');await assert.rejects(f.routes['factionNode.ticket']({}),/accept the current SLINK terms/);assert.equal(f.calls.some(c=>c.url.endsWith('/auth')),false);
});
test('cached test authentication is reused but changing the saved key requires a fresh isolated sign-in',async()=>{
 const f=fixture();await f.routes['factionNode.settings.patch']({enabled:true});await f.routes['factionNode.ticket']({});await f.routes['factionNode.members']();assert.equal(f.reserved,1);f.values.set('access.settings.v1',{tornKey:'different-synthetic-key'});await f.routes['factionNode.ticket']({});assert.equal(f.reserved,2);assert.equal(f.values.get('access.session.v1').token,'production-session-untouched');
});
test('account changes during authentication reject the old response instead of caching it',async()=>{
 const context=vm.createContext({crypto,TextEncoder,URL,Date});vm.runInContext(client,context);let key='first-synthetic-key';const access=context.SLINK_FACTION_NODE.createTestAccess({context:async()=>({enabled:true,key,accepted:[{version:'v',sha256:'h'}]}),request:async(url)=>{if(url.endsWith('/terms'))return {terms:{version:'v',sha256:'h'}};if(url.endsWith('/auth')){key='changed-synthetic-key';return {session_token:'must-not-use',faction_id:46978,scopes:['slink.chat'],iat:Math.floor(Date.now()/1000),expires_at:new Date(Date.now()+7200000).toISOString()};}throw Error('Old authentication reached a chat request');}});await assert.rejects(access.central('token'),/changed during sign-in/);
});
test('view writes are ordered, isolated and contain no chat text or credentials',async()=>{
 const f=fixture(),record={visible:true,view:'chat',roomId:'general',userId:1,factionId:10,draft:'not to store',token:'not to store'};
 await Promise.all([f.routes['factionNode.view.save'](record),f.routes['factionNode.view.save']({...record,visible:false})]);
 const saved=await f.routes['factionNode.view.get']();assert.equal(saved.visible,false);assert.equal('draft' in saved,false);assert.equal('token' in saved,false);assert.equal(f.calls.length,0);
});

test('unrelated settings edits retain the chat window; a real credential change clears the old view',async()=>{
 const content=await readFile(new URL('../src/content/faction-rooms.js',import.meta.url),'utf8');let changed,disposed=0,mounted=0;
 vm.runInNewContext(content,{SLINK_EXTENSION:{STORAGE_PREFIX:'slink.',core:{storage:{get:async()=>({enabled:true})},messaging:{},pageActivity:{}}},SLINK_FACTION_NODE:{create:()=>({})},SLINK_FACTION_NODE_UI:{mount:()=>{mounted++;return {dispose(){disposed++;},sync(){}};}},chrome:{storage:{onChanged:{addListener(fn){changed=fn;}}}}});await new Promise(resolve=>setImmediate(resolve));assert.equal(mounted,1);
 changed({'slink.war.settings.v1':{oldValue:{tornKey:'same-key',filter:1},newValue:{tornKey:'same-key',filter:2}}},'local');await new Promise(resolve=>setImmediate(resolve));assert.equal(disposed,0);assert.equal(mounted,1);
 changed({'slink.access.settings.v1':{oldValue:{tornKey:'old-key'},newValue:{tornKey:'new-key'}}},'local');await new Promise(resolve=>setImmediate(resolve));assert.equal(disposed,1);assert.equal(mounted,2);
});
