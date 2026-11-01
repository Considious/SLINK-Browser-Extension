import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
const source=await readFile(new URL('../src/core/faction-node-client.js',import.meta.url),'utf8');
function fixture(){
  let clock=1000000,next=0,ticketCalls=0,identity=1;const timers=new Map(),sockets=[],requests=[];
  const context=vm.createContext({URL,AbortSignal,fetch,crypto,setTimeout,clearTimeout});vm.runInContext(source,context);
  const client=context.SLINK_FACTION_NODE.create({now:()=>clock,later:(fn,ms)=>{const id=++next;timers.set(id,{fn,ms});return id;},cancel:id=>timers.delete(id),uuid:()=>`id-${++next}`,
    ticket:async()=>{ticketCalls++;return {token:'test-token',expires_at:clock+300000,user_id:identity,faction_id:10,node_id:'node',endpoint:'https://node.example.test'};},members:async()=>({members:[]}),
    request:async(url,options)=>{requests.push({url,options});return {leader:true,rooms:[{room_id:'general',name:'General',visibility:'faction'}],messages:[],next_before:null};},
    socket:(url,protocols)=>{const socket={url,protocols,readyState:1,sent:[],send(raw){this.sent.push(JSON.parse(raw));},close(){this.readyState=3;},event(value){this.onmessage?.({data:JSON.stringify({protocol:1,...value})});}};sockets.push(socket);return socket;}
  });
  return {client,timers,sockets,requests,get ticketCalls(){return ticketCalls;},set identity(value){identity=value;},advance:ms=>{clock+=ms;},welcome:(socket=sockets.at(-1))=>socket.event({type:'welcome',messages:[],access:{read:true,speak:true},presence:[],next_before:null})};
}
test('inactive page makes no request; concurrent operations share one access fetch',async()=>{
  const f=fixture();await assert.rejects(f.client.refresh(),/active Torn page/);assert.equal(f.ticketCalls,0);
  f.client.setActive(true);await Promise.all([f.client.refresh(),f.client.connect('general')]);assert.equal(f.ticketCalls,1);assert.equal(f.sockets.length,1);
  assert.equal(f.sockets[0].url,'wss://node.example.test/api/rooms/general/socket');f.client.dispose();
});
test('broadcast plus acknowledgement and repeated peer events do not duplicate rows or unread count',async()=>{
  const f=fixture();f.client.setActive(true);await f.client.connect('general');f.welcome();const id=f.client.send('general',{type:'text',text:'hello'}),message={message_id:'m1',seq:1,revision:1,user_id:1,content:{type:'text',text:'hello'}};
  f.sockets[0].event({type:'message',message});f.sockets[0].event({type:'ack',client_id:id,message});assert.equal(f.client.room('general').messages.size,1);assert.equal(f.client.room('general').pending.size,0);
  f.sockets[0].event({type:'message',message:{...message,message_id:'m2',seq:2,user_id:2}});f.sockets[0].event({type:'message',message:{...message,message_id:'m2',seq:2,user_id:2}});assert.equal(f.client.room('general').unread,1);f.client.dispose();
});
test('suspending closes the connection but retains messages and pending IDs for safe resume',async()=>{
  const f=fixture();f.client.setActive(true);await f.client.connect('general');f.welcome();const id=f.client.send('general',{type:'text',text:'pending'});
  f.client.setActive(false);assert.equal(f.sockets[0].readyState,3);assert.equal(f.client.room('general').pending.has(id),true);
  f.client.setActive(true);await new Promise(resolve=>setImmediate(resolve));f.welcome();assert.equal(f.sockets[1].sent[0].client_id,id);f.client.dispose();
});
test('renewal sends auth on the same socket rather than creating another one',async()=>{
  const f=fixture();f.client.setActive(true);await f.client.connect('general');f.welcome();const renewal=[...f.timers.values()].find(timer=>timer.ms===280000);f.advance(280000);renewal.fn();await new Promise(resolve=>setImmediate(resolve));assert.equal(f.sockets.length,1);assert.equal(f.sockets[0].sent.at(-1).type,'auth');assert.equal(f.ticketCalls,2);f.client.dispose();
});
test('failed sends retain content and retry with the same idempotency key',async()=>{
  const f=fixture();f.client.setActive(true);await f.client.connect('general');f.welcome();const id=f.client.send('general',{type:'text',text:'keep this'});f.sockets[0].event({type:'error',command_id:id,error:'Muted'});assert.equal(f.client.room('general').pending.get(id).content.text,'keep this');
  f.client.retryPending('general',id);assert.equal(f.sockets[0].sent.at(-1).client_id,id);f.client.discardPending('general',id);assert.equal(f.client.room('general').pending.size,0);f.client.dispose();
});
test('edit/delete promises wait for acknowledgement and reject errors without changing drafts',async()=>{
  const f=fixture();f.client.setActive(true);await f.client.connect('general');f.welcome();let settled=false;const promise=f.client.action('general',{type:'edit',message_id:'m1',content:{type:'text',text:'changed'}}).then(()=>{settled=true;});await Promise.resolve();assert.equal(settled,false);const sent=f.sockets[0].sent.at(-1);f.sockets[0].event({type:'action_ack',command_id:sent.command_id});await promise;assert.equal(settled,true);
  const failure=f.client.action('general',{type:'delete',message_id:'m1'});const command=f.sockets[0].sent.at(-1);f.sockets[0].event({type:'error',command_id:command.command_id,error:'Not allowed'});await assert.rejects(failure,/Not allowed/);f.client.dispose();
});
test('an account change clears old room state and does not reconnect it for the new user',async()=>{
  const f=fixture();f.client.setActive(true);await f.client.connect('general');f.welcome();f.client.send('general',{type:'text',text:'private old draft'});f.identity=2;f.advance(280000);await f.client.refresh();assert.equal(f.client.model.userId,2);assert.equal(f.client.room('general').pending.size,0);assert.equal(f.sockets[0].readyState,3);f.client.dispose();
});
test('rapid welcome/disconnect loops do not reset the reconnect limit forever',async()=>{
 const f=fixture();f.client.setActive(true);await f.client.connect('general');
 try{for(let i=0;i<4;i++){f.welcome();const socket=f.sockets.at(-1);socket.readyState=3;socket.onclose({code:1006});const retry=[...f.timers.entries()].find(([,timer])=>[1500,5000,15000].includes(timer.ms));if(i===3){assert.equal(retry,undefined);break;}assert.ok(retry);assert.equal(retry[1].ms,[1500,5000,15000][i]);f.timers.delete(retry[0]);retry[1].fn();await new Promise(resolve=>setImmediate(resolve));}}finally{f.client.dispose();}
});

test('a stable connection resets the retry budget, while rate rejection requires a cooldown',async()=>{
 const f=fixture();f.client.setActive(true);await f.client.connect('general');f.welcome();f.client.room('general').attempts=3;f.advance(30000);f.sockets.at(-1).onclose({code:1006});assert.ok([...f.timers.values()].some(timer=>timer.ms===1500));
 await f.client.connect('general',true);f.welcome();f.sockets.at(-1).onclose({code:4008});const count=f.sockets.length;await f.client.connect('general',true);assert.equal(f.sockets.length,count);assert.match(f.client.room('general').error,/Wait a minute/);assert.equal([...f.timers.values()].some(timer=>[1500,5000,15000].includes(timer.ms)),false);f.advance(60000);await f.client.connect('general',true);assert.equal(f.sockets.length,count+1);f.client.dispose();
});
