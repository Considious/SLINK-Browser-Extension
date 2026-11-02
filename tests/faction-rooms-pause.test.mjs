import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
test('only opted-in ready room management survives activity pause, but not revocation or full cleanup',async()=>{
 const counts={start:0,suspend:0,resume:0,stop:0,workerStop:0,remove:0};let active=true,allowed=true;
 const S={core:{permissions:{hasAllScopes:()=>allowed},format:{errorMessage:String}},modules:{},define(group,name,value){this[group][name]=value;}};
 const ctx=vm.createContext({SLINK_EXTENSION:S,AbortController,console});vm.runInContext(fs.readFileSync(new URL('../src/core/modules.js',import.meta.url),'utf8'),ctx);
 const ui={setStatus(){},remove(){counts.remove++;}},context={url:new URL('https://www.torn.com/'),permissions:{},isActive:()=>active,ui:{createModuleView:async()=>ui}};
 S.modules.register({id:'rooms',retainOnPause:true,start(){counts.start++;return {suspend(){counts.suspend++;},resume(){counts.resume++;},stop(){counts.stop++;}};}});
 S.modules.register({id:'collector',start(){return {stop(){counts.workerStop++;}};}});
 await S.modules.startAll(context);active=false;S.modules.invalidate({pause:true});await S.modules.stopAll({preserveUi:true,pause:true});
 assert.equal(counts.stop,0);assert.equal(counts.workerStop,1);active=true;await S.modules.startAll(context);assert.equal(counts.start,1);assert.equal(counts.resume,1);
 active=false;await S.modules.stopAll({preserveUi:true,pause:true});allowed=false;active=true;await S.modules.startAll(context);assert.equal(counts.stop,1,'Revocation removes retained manager');assert.equal(counts.resume,1);assert.equal(counts.remove,1);
 allowed=true;await S.modules.startAll(context);await S.modules.stopAll();assert.equal(counts.stop,2,'Full cleanup always destroys manager');
 const content=fs.readFileSync(new URL('../src/content/content-script.js',import.meta.url),'utf8');assert.match(content,/invalidate\?\.\(\{pause:true\}\)/);assert.match(content,/stopAll\(\{ preserveUi:true,pause:true \}\)/);
});
