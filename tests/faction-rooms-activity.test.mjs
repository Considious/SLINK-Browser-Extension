import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source=fs.readFileSync(new URL('../src/core/faction-node-client.js',import.meta.url),'utf8');
const channels=new Set();let ids=0;
class Channel{constructor(){channels.add(this);}postMessage(data){for(const other of channels)if(other!==this)other.onmessage?.({data});}close(){channels.delete(this);}}
function fixture({focused=true,focusRequired=true}={}){
 const events=new Map(),docEvents=new Map(),subscribers=new Set(),timers=new Map();let grant=focused,clock=1000,next=0;
 const doc={visibilityState:'visible',hasFocus:()=>focused,addEventListener:(name,fn)=>docEvents.set(name,fn),removeEventListener:name=>docEvents.delete(name)};
 const activity={eligible:()=>grant,subscribe:fn=>{subscribers.add(fn);return()=>subscribers.delete(fn);}};
 const ctx=vm.createContext({console,Date,crypto:{randomUUID:()=>String(++ids)},BroadcastChannel:Channel,document:doc,addEventListener:(name,fn)=>events.set(name,fn),removeEventListener:name=>events.delete(name)});
 vm.runInContext(source,ctx);const rooms=ctx.SLINK_FACTION_NODE.createRoomActivity({activity,focusRequired,now:()=>clock,later:(fn,ms)=>{const id=++next;timers.set(id,{fn,at:clock+ms});return id;},cancel:id=>timers.delete(id)});
 return {rooms,doc,activity,tick(ms){const target=clock+ms;for(;;){const due=[...timers].filter(([,timer])=>timer.at<=target).sort((a,b)=>a[1].at-b[1].at)[0];if(!due)break;clock=due[1].at;timers.delete(due[0]);due[1].fn();}clock=target;},focus(value){focused=value;grant=value;events.get(value?'focus':'blur')?.();for(const fn of subscribers)fn(value);},event:name=>events.get(name)?.(),setGrant(value){grant=value;for(const fn of subscribers)fn(value);}};
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

test('configured idle duration expires exactly; Never has no idle disconnect and focus resets the timer',()=>{
 const f=fixture();f.rooms.setIdleMinutes(1);f.focus(false);f.tick(59999);assert(f.rooms.eligible());f.tick(1);assert.equal(f.rooms.eligible(),false);assert.equal(f.activity.eligible(),false);
 f.focus(true);assert(f.rooms.eligible());f.rooms.setIdleMinutes(5);f.focus(false);f.tick(120000);f.focus(true);f.tick(600000);assert(f.rooms.eligible());
 f.rooms.setIdleMinutes(0);f.focus(false);f.tick(24*3600000);assert(f.rooms.eligible());assert.equal(f.activity.eligible(),false);f.rooms.dispose();assert.throws(()=>f.rooms.setIdleMinutes(2),/Invalid/);
});
