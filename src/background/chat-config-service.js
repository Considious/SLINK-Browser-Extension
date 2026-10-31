(function installChatConfig(global) {
  'use strict';
  const SLINK=global.SLINK_EXTENSION, KEY='qol.chat.macros.v1', SCOPE='slink.qol.chat';
  const scopes=new Set(['faction','private','newsletter','both','faction_newsletter','private_newsletter','all']);
  let queue=Promise.resolve();
  const giphy=global.SLINK_GIPHY?.createClient({
    read:()=>SLINK.core.storage.get('qol.chat.giphy.v1',{}),
    write:value=>SLINK.core.storage.set('qol.chat.giphy.v1',value),
    authorize, request:global.SLINK_GIPHY.request
  });
  const HIGHLIGHTS_KEY='qol.chat.highlights.v1';
  const colors=new Set(['yellow','orange','red','pink','purple','blue','cyan','green','lime','white']);
  let highlightQueue=Promise.resolve();
  function highlightRows(value){
    const used=new Set();return (Array.isArray(value?.highlights)?value.highlights:[]).map((row,index)=>{
      let id=String(row?.id||'legacy-highlight-'+index);while(used.has(id))id+='-';used.add(id);
      return {...row,id,term:String(row?.term||'').trim().slice(0,80),color:colors.has(row?.color)?row.color:'yellow',enabled:row?.enabled!==false};
    });
  }
  function updateHighlights(input,operation){
    const captured={...input,changes:{...input?.changes}};
    const auth=Promise.resolve().then(authorize);void auth.catch(()=>{});
    const task=highlightQueue.catch(()=>{}).then(()=>auth).then(async()=>{
      const previous=await SLINK.core.storage.get(HIGHLIGHTS_KEY,{}),rows=highlightRows(previous),id=String(captured.id||'');
      const index=rows.findIndex(row=>row.id===id);if(!id)throw Error('Choose a highlight row.');
      if(operation==='add'){if(index>=0||rows.length>=200)throw Error('Use a unique ID and up to 200 highlight terms.');rows.push({id,term:'',color:'yellow',enabled:true});}
      else {if(index<0)throw Error('This highlight was removed. Reopen the Chat editor.');
        if(operation==='remove')rows.splice(index,1);
        else {const patch=Object.fromEntries(Object.entries(captured.changes).filter(([key])=>['term','color','enabled'].includes(key)));rows[index]=highlightRows({highlights:[{...rows[index],...patch}]})[0];}
      }
      const next={...previous,highlights:rows};await SLINK.core.storage.set(HIGHLIGHTS_KEY,next);
      return {row:rows.find(row=>row.id===id)||null,removed:operation==='remove',id};
    });highlightQueue=task;return task;
  }
  async function authorize(){
    const session=await SLINK.services.permissionAccess.ensureSession(false,SCOPE);
    if(!SLINK.core.permissions.hasScope(session,SCOPE))throw Error('Chat permission is required.');
  }
  function normalize(rows) {
    if(!Array.isArray(rows)||rows.length>200)throw Error('Supply up to 200 custom buttons.');
    const ids=new Set();
    return rows.map(row=>{
      const value={id:String(row.id||global.crypto.randomUUID()),label:String(row.label||'').trim(),message:String(row.message||''),scope:scopes.has(row.scope)?row.scope:'both',enabled:row.enabled!==false};
      if(!value.label||value.label.length>80||!value.message.trim()||value.message.length>60000||ids.has(value.id))throw Error('Each button needs a unique ID, a label up to 80 characters and a message up to 60,000 characters.');
      ids.add(value.id);return value;
    });
  }
  function update(task){const next=queue.catch(()=>{}).then(task);queue=next;return next;}
  async function read(){return await SLINK.core.storage.get(KEY,{revision:0,macros:[],legacyImported:false});}
  const routes={
    'chat.giphy.get':()=>giphy.get(),
    'chat.giphy.patch':changes=>giphy.patch(changes),
    'chat.giphy.search':input=>giphy.search(input),
    async 'chat.highlights.get'(){await authorize();await highlightQueue.catch(()=>{});const stored=await SLINK.core.storage.get(HIGHLIGHTS_KEY,{});return {...stored,highlights:highlightRows(stored)};},
    'chat.highlights.add':input=>updateHighlights(input,'add'),
    'chat.highlights.patch':input=>updateHighlights(input,'patch'),
    'chat.highlights.remove':input=>updateHighlights(input,'remove'),
    async 'chat.macros.get'(){await authorize();await queue.catch(()=>{});return read();},
    'chat.macros.save'(input={}) {const captured={expectedRevision:input.expectedRevision,macros:Array.isArray(input.macros)?input.macros.map(row=>({...row})):input.macros};return update(async()=>{
      await authorize();const previous=await read();
      if(Number(captured.expectedRevision)!==Number(previous.revision))throw Error('Chat buttons changed in another page. Reopen the editor before saving; your draft has been kept.');
      const next={...previous,macros:normalize(captured.macros),revision:Number(previous.revision)+1};
      await SLINK.core.storage.set(KEY,next);return next;
    });},
    'chat.macros.importLegacy'(input={}) {return update(async()=>{
      await authorize();const previous=await read();if(previous.legacyImported)return previous;
      const rows=normalize(input.macros||[]),ids=new Set(previous.macros.map(row=>row.id));
      const next={...previous,macros:[...previous.macros,...rows.filter(row=>!ids.has(row.id))],legacyImported:true,revision:Number(previous.revision)+1};
      await SLINK.core.storage.set(KEY,next);return next;
    });}
  };
  SLINK.define('services','chatConfig',Object.freeze({routes:Object.freeze(routes)}));
})(globalThis);
