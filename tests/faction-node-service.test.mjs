import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const source=await readFile(new URL('../src/background/faction-node-service.js',import.meta.url),'utf8');
function fixture(){const values=new Map(),calls=[],auth=[];let failures=0;const extension={services:{permissionAccess:{ensureSession:async(force,scope)=>{auth.push({force,scope});return {token:'permission-only-token'};}}},core:{storage:{get:async(key,fallback)=>values.get(key)||fallback,set:async(key,value)=>{values.set(key,value);return value;}},http:{requestJson:async(provider,url,options)=>{calls.push({provider,url,options});if(failures-->0){const error=Error('Refresh membership');error.status=428;throw error;}return {token:'chat-token',members:[]};}}},define(group,name,value){this[group][name]=value;}};vm.runInNewContext(source,{SLINK_EXTENSION:extension});return {routes:extension.services.factionNode.routes,values,calls,auth,set failures(value){failures=value;}};}
test('new chat stays off by default and its setting is isolated from existing preferences',async()=>{
 const f=fixture();f.values.set('chat.settings.v1',{ffBubbles:true});assert.equal((await f.routes['factionNode.settings.get']()).enabled,false);assert.equal(f.calls.length,0);
 await f.routes['factionNode.settings.patch']({enabled:true});assert.equal(f.values.get('chat.settings.v1').ffBubbles,true);assert.equal(f.calls.length,0);
 await assert.rejects(f.routes['factionNode.settings.patch']({enabled:true,clearEverything:true}));
});
test('ticket uses the existing permission session, not a Torn API key, and shares concurrent requests',async()=>{
 const f=fixture();await Promise.all([f.routes['factionNode.ticket']({}),f.routes['factionNode.ticket']({})]);assert.equal(f.calls.length,1);assert.equal(f.auth[0].scope,'slink.chat');assert.equal(f.calls[0].options.headers.Authorization,'Bearer permission-only-token');assert.equal(f.calls[0].options.body,'{}');
});
test('stale identity refreshes once and repeated failure does not loop',async()=>{
 const f=fixture();f.failures=2;await assert.rejects(f.routes['factionNode.ticket']({}));assert.equal(f.calls.length,2);assert.equal(f.auth[1].force,true);
});
test('view writes are ordered, isolated and contain no chat text or credentials',async()=>{
 const f=fixture(),record={visible:true,view:'chat',roomId:'general',userId:1,factionId:10,draft:'not to store',token:'not to store'};
 await Promise.all([f.routes['factionNode.view.save'](record),f.routes['factionNode.view.save']({...record,visible:false})]);
 const saved=await f.routes['factionNode.view.get']();assert.equal(saved.visible,false);assert.equal('draft' in saved,false);assert.equal('token' in saved,false);assert.equal(f.calls.length,0);
});
