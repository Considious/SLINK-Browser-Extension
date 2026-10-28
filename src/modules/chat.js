(function registerChatModule(global) {
  'use strict';
  const SLINK = global.SLINK_EXTENSION;
  const COLORS = Object.freeze([
    ['yellow','#ffe066','#241f00'],['orange','#ff9f43','#2b1300'],['red','#ff6b6b','#2a0000'],
    ['pink','#ff85c2','#2a0016'],['purple','#c792ea','#170025'],['blue','#74c0fc','#001c2e'],
    ['cyan','#66d9e8','#002126'],['green','#8ce99a','#002607'],['lime','#c0eb75','#172500'],['white','#f1f3f5','#111']
  ]);
  const MESSAGE_SELECTOR = '[class*="messageContent___"], [class*="messageText___"], .msg';
  let settings = { highlights:[] };
  let observer = null;
  let scanTimer = null;

  function escape(value) { return SLINK.core.format.escapeHtml(value); }
  function normalized(value) {
    const rows = Array.isArray(value?.highlights) ? value.highlights : [];
    return { highlights:rows.map((row,index)=>({
      id:String(row?.id || `term-${Date.now()}-${index}`),
      term:String(row?.term || '').trim().slice(0,80),
      color:COLORS.some(([id])=>id===row?.color) ? row.color : 'yellow',
      enabled:row?.enabled !== false
    })).filter(row=>row.term) };
  }
  function color(id) { return COLORS.find(([key])=>key===id) || COLORS[0]; }
  function regexEscape(value) { return String(value).replace(/[.*+?^${}()|[\]\\]/g,'\\$&'); }
  function clearHighlights() {
    document.querySelectorAll('mark[data-slink-chat-highlight]').forEach(mark => mark.replaceWith(document.createTextNode(mark.textContent || '')));
    document.querySelectorAll(MESSAGE_SELECTOR).forEach(node => { delete node.dataset.slinkChatHighlighted; node.normalize(); });
  }
  function highlightNode(container) {
    if (!(container instanceof Element) || container.dataset.slinkChatHighlighted === 'true') return;
    const active = settings.highlights.filter(row=>row.enabled && row.term);
    if (!active.length) { container.dataset.slinkChatHighlighted='true'; return; }
    const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        if (!node.nodeValue?.trim() || node.parentElement?.closest('a,button,textarea,input,mark,[contenteditable="true"],style,script')) return NodeFilter.FILTER_REJECT;
        return active.some(row=>new RegExp(regexEscape(row.term),'i').test(node.nodeValue)) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
      }
    });
    const nodes=[]; while(walker.nextNode()) nodes.push(walker.currentNode);
    for(const node of nodes) {
      const pattern = new RegExp(active.map(row=>`(${regexEscape(row.term)})`).join('|'),'gi');
      const fragment=document.createDocumentFragment(); let last=0;
      let found;
      pattern.lastIndex=0;
      while((found=pattern.exec(node.nodeValue))!==null){
        if(found.index>last) fragment.append(document.createTextNode(node.nodeValue.slice(last,found.index)));
        const row=active.find(candidate=>candidate.term.toLowerCase()===found[0].toLowerCase()) || active.find(candidate=>new RegExp(regexEscape(candidate.term),'i').test(found[0]));
        const [,background,foreground]=color(row?.color);
        const mark=document.createElement('mark'); mark.dataset.slinkChatHighlight='true'; mark.textContent=found[0]; mark.style.cssText=`background:${background};color:${foreground};padding:0 2px;border-radius:3px;font-weight:800`;
        fragment.append(mark); last=found.index+found[0].length;
        if(found[0].length===0) pattern.lastIndex++;
      }
      if(last<node.nodeValue.length) fragment.append(document.createTextNode(node.nodeValue.slice(last)));
      node.replaceWith(fragment);
    }
    container.dataset.slinkChatHighlighted='true';
  }
  function scanHighlights() { if (SLINK.core.pageActivity?.eligible()) document.querySelectorAll(MESSAGE_SELECTOR).forEach(highlightNode); }
  function scheduleScan() { if (!SLINK.core.pageActivity?.eligible()) return; clearTimeout(scanTimer); scanTimer=setTimeout(scanHighlights,80); }

  SLINK.modules.register({
    id:'chat', title:'Chat', shortTitle:'Chat', group:'quality-of-life', groupTitle:'Quality of Life',
    requiredScopes:[], permissionTest:permissions=>['slink.qol.chat','admin.*'].some(scope=>SLINK.core.permissions.hasScope(permissions,scope)),
    defaultShowInTorn:true, matches:url=>url.hostname==='www.torn.com',
    async start(context) {
      const ui=context.ui,root=ui.getContentElement(),dashboard=context.presentation==='dashboard';
      let stopped=false,macroSaving=false,macroStructure=0,adding=false;
      let macroRecord=dashboard?await SLINK.core.messaging.send('chat.macros.get'):null;
      const highlightRecord=await SLINK.core.messaging.send('chat.highlights.get');
      if(context.signal?.aborted)return {stop(){}};
      const priorExplicit=root.dataset.uiExplicitCommit;root.dataset.uiExplicitCommit='true';
      const drafts=SLINK.core.formState.protect(root.getRootNode?.()||root);
      const rows=new Map();
      const allowed=()=>!stopped&&!context.signal?.aborted;
      function updateHighlighting(){
        settings=normalized({highlights:[...rows.values()].map(record=>record.model)});
        if(!dashboard&&allowed()&&SLINK.core.pageActivity?.eligible()){clearHighlights();scheduleScan();}
      }
      function report(error){if(allowed())ui.setStatus(SLINK.core.format.errorMessage(error),'error');}
      function macroRow(row){
        const node=document.createElement('div');node.className='slink-chat-card';node.dataset.macroId=row.id;
        const options=['faction','private','newsletter','both','faction_newsletter','private_newsletter','all'];
        node.innerHTML='<label>Label<input id="macro-label-'+escape(row.id)+'" data-macro-label maxlength="80" value="'+escape(row.label)+'"></label><label>Message<textarea id="macro-message-'+escape(row.id)+'" data-macro-message maxlength="60000">'+escape(row.message)+'</textarea></label><label>Destination<select id="macro-scope-'+escape(row.id)+'" data-macro-scope>'+options.map(scope=>'<option '+(row.scope===scope?'selected':'')+'>'+scope+'</option>').join('')+'</select></label><label><input id="macro-enabled-'+escape(row.id)+'" data-macro-enabled type="checkbox" '+(row.enabled?'checked':'')+'> Enabled</label><button type="button" data-macro-remove>Remove button</button>';
        return node;
      }
      function readMacros(){return [...root.querySelectorAll('[data-macro-id]')].map(node=>({id:node.dataset.macroId,label:node.querySelector('[data-macro-label]').value,message:node.querySelector('[data-macro-message]').value,scope:node.querySelector('[data-macro-scope]').value,enabled:node.querySelector('[data-macro-enabled]').checked}));}
      function attachHighlight(record){
        const node=record.node,id=record.model.id,suffix=encodeURIComponent(id);
        const fields={};for(const key of ['term','color','enabled'])fields['chat-highlight-'+key+'-'+suffix]=key;
        record.controller=SLINK.core.formState.autosave({root:node,fields,read:key=>record.model[key],
          save:changes=>SLINK.core.messaging.send('chat.highlights.patch',{id,changes}),select:response=>response.row,
          onCommit:patch=>{record.model={...record.model,...patch};updateHighlighting();},
          onState:state=>{if(!allowed()||record.removing)return;node.querySelector('[data-chat-row-state]').textContent=({idle:'',saving:'Saving…',saved:'Saved.',failed:'Not saved. Retry.',invalid:'Incomplete.',unsaved:'Not saved yet.'})[state.state]||'';node.querySelector('[data-chat-retry]').hidden=state.state!=='failed';}
        });record.controller.mount();
      }
      function addHighlight(row){
        const node=document.createElement('div');node.dataset.chatHighlightRow='';node.dataset.chatId=row.id;
        const suffix=encodeURIComponent(row.id);
        node.innerHTML='<div class="slink-chat-row"><input id="chat-highlight-term-'+escape(suffix)+'" type="text" data-chat-term value="'+escape(row.term)+'" placeholder="Term or phrase" maxlength="80"><select id="chat-highlight-color-'+escape(suffix)+'" data-chat-color>'+COLORS.map(([id])=>'<option value="'+id+'" '+(row.color===id?'selected':'')+'>'+id+'</option>').join('')+'</select><label><input id="chat-highlight-enabled-'+escape(suffix)+'" type="checkbox" data-chat-enabled '+(row.enabled?'checked':'')+'> On</label><button type="button" data-chat-delete aria-label="Delete highlight">×</button></div><small data-chat-row-state role="status"></small> <button type="button" data-chat-retry hidden>Retry</button>';
        const record={model:row,node,controller:null,removing:false};rows.set(row.id,record);root.querySelector('[data-chat-rows]').append(node);attachHighlight(record);
      }
      ui.setModuleStyles('.slink-chat-stack{display:grid;gap:9px}.slink-chat-card{min-width:0;padding:9px;border:1px solid var(--slink-border-soft);border-radius:8px;background:var(--slink-bg-control)}.slink-chat-card h3{margin:0 0 4px}.slink-chat-card p{margin:3px 0 8px;color:var(--slink-muted)}.slink-chat-row{display:grid;grid-template-columns:minmax(100px,1fr) minmax(85px,110px) auto auto;gap:6px;align-items:center;margin-top:6px}.slink-chat-row input[type=text],.slink-chat-row select,[data-macro-id] input:not([type=checkbox]),[data-macro-id] textarea,[data-macro-id] select{box-sizing:border-box;width:100%;min-width:0;padding:6px;border:1px solid var(--slink-border-soft);border-radius:5px;background:var(--slink-bg);color:var(--slink-text)}[data-macro-id] label{display:grid;gap:4px;margin:6px 0}[data-macro-id] textarea{min-height:100px}.slink-chat-actions{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px}.slink-chat-actions button{padding:5px 8px}.slink-chat-token{font-family:monospace;color:var(--slink-accent)}@media(max-width:430px){.slink-chat-row{grid-template-columns:minmax(0,1fr) 95px auto}.slink-chat-row label{grid-column:1/-1}}');
      ui.setContentHtml('<div class="slink-chat-stack"><section class="slink-chat-card"><h3>Custom chat buttons</h3><p>Custom buttons keep the existing two-click load/send flow. Sending always needs your click.</p><button type="button" data-chat-manage>Manage custom buttons</button><p>Tokens: {{page_link}}, {{page_link:Label}}, {{page_url}}, {{page_title}}. Links are quoted before sending.</p></section><section class="slink-chat-card"><h3>Highlight chat terms</h3><p>Terms, colors and toggles save automatically on this device.</p><div data-chat-rows></div><button type="button" data-chat-add>Add term</button></section><p data-chat-notice role="status"></p></div>');
      for(const row of highlightRecord.highlights||[])addHighlight(row);
      const giphyPanel=global.SLINK_GIPHY_PANEL?.();
      if(giphyPanel)root.querySelector('.slink-chat-stack').append(giphyPanel.host);
      if(dashboard){
        root.querySelector('[data-chat-manage]').hidden=true;
        const editor=document.createElement('section');editor.className='slink-chat-card';editor.dataset.macroEditor='';
        editor.innerHTML='<h3>Custom buttons</h3><p>Compose templates here, then save the collection. This does not send any message.</p><div data-macro-rows></div><div class="slink-chat-actions"><button type="button" data-macro-add>Add button</button><button type="button" data-macro-save>Save buttons</button></div><p data-macro-notice role="status"></p>';
        root.querySelector('.slink-chat-stack').append(editor);for(const row of macroRecord.macros)editor.querySelector('[data-macro-rows]').append(macroRow(row));
      }else global.dispatchEvent(new CustomEvent('slink-chat-enable'));
      context.listen(root,'click',async event=>{
        if(!allowed())return;
        const target=event.target;
        if(target.closest('[data-chat-manage]')){global.dispatchEvent(new CustomEvent('slink-chat-open-editor'));return;}
        if(target.closest('[data-chat-add]')){
          if(adding)return;adding=true;const button=root.querySelector('[data-chat-add]');button.disabled=true;
          try{const result=await SLINK.core.messaging.send('chat.highlights.add',{id:crypto.randomUUID()});if(allowed()){addHighlight(result.row);rows.get(result.row.id).node.querySelector('[data-chat-term]').focus();}}
          catch(error){report(error);}finally{adding=false;if(allowed())button.disabled=false;}return;
        }
        const highlight=target.closest('[data-chat-highlight-row]'),record=highlight&&rows.get(highlight.dataset.chatId);
        if(record&&target.closest('[data-chat-retry]')){void record.controller.retry().catch(()=>{});return;}
        if(record&&target.closest('[data-chat-delete]')){
          if(record.removing)return;record.removing=true;highlight.querySelector('[data-chat-delete]').disabled=true;
          try{await record.controller.stop();const result=await SLINK.core.messaging.send('chat.highlights.remove',{id:record.model.id});if(result.removed!==true)throw Error('Highlight removal was not confirmed.');if(allowed()){drafts?.cancel(highlight);highlight.remove();rows.delete(record.model.id);updateHighlighting();}}
          catch(error){if(allowed()){record.removing=false;attachHighlight(record);report(error);highlight.querySelector('[data-chat-delete]').disabled=false;}}return;
        }
        if(target.closest('[data-macro-add]')){macroStructure++;root.querySelector('[data-macro-rows]').append(macroRow({id:crypto.randomUUID(),label:'',message:'',scope:'both',enabled:true}));return;}
        const removed=target.closest('[data-macro-remove]');
        if(removed){macroStructure++;const node=removed.closest('[data-macro-id]');drafts?.cancel(node);node.remove();return;}
        if(target.closest('[data-macro-save]')){
          if(macroSaving)return;macroSaving=true;const button=root.querySelector('[data-macro-save]');button.disabled=true;
          const macros=readMacros(),structure=macroStructure,revision=macroRecord.revision;
          const captures=[...root.querySelectorAll('[data-macro-id] input,[data-macro-id] textarea,[data-macro-id] select')].map(control=>({control,ticket:drafts?.begin(control)}));
          try{
            const saved=await SLINK.core.messaging.send('chat.macros.save',{expectedRevision:revision,macros});
            if(!Array.isArray(saved?.macros)||!Number.isFinite(Number(saved.revision)))throw Error('Chat buttons were not acknowledged.');
            if(!allowed())return;macroRecord.revision=saved.revision;
            for(const {control,ticket}of captures)if(drafts?.commit(ticket)&&control.isConnected){const row=saved.macros.find(row=>row.id===control.closest('[data-macro-id]').dataset.macroId);if(!row)continue;if(control.matches('[data-macro-enabled]'))control.checked=row.enabled;else control.value=control.matches('[data-macro-label]')?row.label:control.matches('[data-macro-message]')?row.message:row.scope;}
            if(structure===macroStructure)macroRecord.macros=saved.macros;
            root.querySelector('[data-macro-notice]').textContent='Buttons saved. Newer edits remain in the editor.';
          }catch(error){if(allowed())root.querySelector('[data-macro-notice]').textContent=SLINK.core.format.errorMessage(error);}
          finally{macroSaving=false;if(allowed())button.disabled=false;}
        }
      });
      updateHighlighting();
      function hasActiveHighlights() { return settings.highlights.some(item => item.enabled && String(item.term || '').trim()); }
      function mutationContainsChatMessage(mutation) {
        if (mutation.target?.closest?.(MESSAGE_SELECTOR)) return true;
        return [...mutation.addedNodes].some(node => node.nodeType === Node.ELEMENT_NODE && (node.matches?.(MESSAGE_SELECTOR) || node.querySelector?.(MESSAGE_SELECTOR)));
      }
      if(!dashboard){observer=new MutationObserver(mutations => { if (hasActiveHighlights() && mutations.some(mutationContainsChatMessage)) scheduleScan(); });
      observer.observe(document.body,{childList:true,subtree:true});
      if (hasActiveHighlights()) scanHighlights();}
      return {async stop(){stopped=true;observer?.disconnect();observer=null;clearTimeout(scanTimer);await Promise.all([...rows.values()].map(record=>record.controller.stop()));await giphyPanel?.stop();if(priorExplicit===undefined)delete root.dataset.uiExplicitCommit;else root.dataset.uiExplicitCommit=priorExplicit;if(!dashboard)global.dispatchEvent(new CustomEvent('slink-chat-disable'));}};
    }
  });
})(globalThis);
