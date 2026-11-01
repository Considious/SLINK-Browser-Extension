import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source=fs.readFileSync(new URL('../src/core/faction-node-client.js',import.meta.url),'utf8');
const channels=new Set();let ids=0;
class Channel{constructor(){channels.add(this);}postMessage(data){for(const other of channels)if(other!==this)other.onmessage?.({data});}close(){channels.delete(this);}}
function fixture({focused=true,focusRequired=true}={}){
 const events=new Map(),docEvents=new Map(),subscribers=new Set();let grant=focused;
 const doc={visibilityState:'visible',hasFocus:()=>focused,addEventListener:(name,fn)=>docEvents.set(name,fn),removeEventListener:name=>docEvents.delete(name)};
 const activity={eligible:()=>grant,subscribe:fn=>{subscribers.add(fn);return()=>subscribers.delete(fn);}};
 const ctx=vm.createContext({console,Date,crypto:{randomUUID:()=>String(++ids)},BroadcastChannel:Channel,document:doc,addEventListener:(name,fn)=>events.set(name,fn),removeEventListener:name=>events.delete(name)});
 vm.runInContext(source,ctx);const rooms=ctx.SLINK_FACTION_NODE.createRoomActivity({activity,focusRequired});
 return {rooms,doc,activity,focus(value){focused=value;grant=value;events.get(value?'focus':'blur')?.();for(const fn of subscribers)fn(value);},event:name=>events.get(name)?.(),setGrant(value){grant=value;for(const fn of subscribers)fn(value);}};
}
test('Rooms retain third-party ownership on blur/hidden while Torn activity remains false',()=>{
 const f=fixture();assert(f.rooms.eligible());f.focus(false);assert.equal(f.activity.eligible(),false);assert(f.rooms.eligible());f.doc.visibilityState='hidden';assert(f.rooms.eligible());f.event('pagehide');assert.equal(f.rooms.eligible(),false);f.rooms.dispose();
});
test('a newly focused Torn tab takes ownership without leaving multiple room runners',()=>{
 const a=fixture(),b=fixture({focused:false});assert(a.rooms.eligible());assert.equal(b.rooms.eligible(),false);a.focus(false);b.focus(true);assert.equal(a.rooms.eligible(),false);assert(b.rooms.eligible());b.focus(false);assert(b.rooms.eligible(),'Leaving Torn for another app must not kill the last room runner');a.focus(true);assert(a.rooms.eligible());assert.equal(b.rooms.eligible(),false);a.rooms.dispose();b.rooms.dispose();
});
test('PDA may acquire Rooms without trusting WebView hasFocus',()=>{
 const f=fixture({focused:false,focusRequired:false});f.setGrant(true);assert(f.rooms.eligible());f.setGrant(false);assert(f.rooms.eligible());f.rooms.dispose();
});
test('disposing Rooms removes its listeners and channel without changing the collector gate',()=>{
 const f=fixture(),count=channels.size;f.rooms.dispose();assert.equal(channels.size,count-1);assert.equal(f.activity.eligible(),true);assert.equal(f.rooms.eligible(),false);
});
