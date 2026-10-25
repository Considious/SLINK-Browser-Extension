(function installChatConfig(global) {
  'use strict';
  const SLINK=global.SLINK_EXTENSION, KEY='qol.chat.macros.v1', SCOPE='slink.qol.chat';
  const scopes=new Set(['faction','private','newsletter','both','faction_newsletter','private_newsletter','all']);
  let queue=Promise.resolve();
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
    async 'chat.macros.get'(){await authorize();await queue.catch(()=>{});return read();},
    'chat.macros.save'(input={}) {return update(async()=>{
      await authorize();const previous=await read();
      if(Number(input.expectedRevision)!==Number(previous.revision))throw Error('Chat buttons changed in another page. Reopen the editor before saving; your draft has been kept.');
      const next={...previous,macros:normalize(input.macros),revision:Number(previous.revision)+1};
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
