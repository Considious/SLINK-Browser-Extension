(function registerChatModule(global) {
  'use strict';
  const SLINK = global.SLINK_EXTENSION;
  const STORAGE_KEY = 'qol.chat.highlights.v1';
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
  function scanHighlights() { document.querySelectorAll(MESSAGE_SELECTOR).forEach(highlightNode); }
  function scheduleScan() { clearTimeout(scanTimer); scanTimer=setTimeout(scanHighlights,80); }

  SLINK.modules.register({
    id:'chat', title:'Chat', shortTitle:'Chat', group:'quality-of-life', groupTitle:'Quality of Life',
    requiredScopes:[], permissionTest:permissions=>['slink.qol.chat','admin.*'].some(scope=>SLINK.core.permissions.hasScope(permissions,scope)),
    defaultShowInTorn:true, matches:url=>url.hostname==='www.torn.com',
    async start(context) {
      const ui=context.ui;
      settings=normalized(await SLINK.core.storage.get(STORAGE_KEY,{highlights:[]}));
      global.dispatchEvent(new CustomEvent('slink-chat-enable'));
      ui.setModuleStyles(`
        .slink-chat-stack{display:grid;gap:9px}.slink-chat-card{padding:9px;border:1px solid var(--slink-border-soft);border-radius:8px;background:var(--slink-bg-control)}
        .slink-chat-card h3{margin:0 0 4px}.slink-chat-card p{margin:3px 0 8px;color:var(--slink-muted)}
        .slink-chat-row{display:grid;grid-template-columns:minmax(110px,1fr) minmax(95px,130px) auto auto;gap:6px;align-items:center;margin-top:6px}
        .slink-chat-row input[type=text],.slink-chat-row select{width:100%;min-width:0;padding:6px;border:1px solid var(--slink-border-soft);border-radius:5px;background:var(--slink-bg);color:var(--slink-text)}
        .slink-chat-actions{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px}.slink-chat-actions button{padding:5px 8px}
        .slink-chat-token{font-family:monospace;color:var(--slink-accent)}
        @media(max-width:430px){.slink-chat-row{grid-template-columns:minmax(0,1fr) 105px auto}.slink-chat-row label{grid-column:1/-1}}
      `);
      function render() {
        const rows=settings.highlights.map(row=>`<div class="slink-chat-row" data-chat-highlight-row data-chat-id="${escape(row.id)}"><input type="text" data-chat-term value="${escape(row.term)}" placeholder="Term or phrase"><select data-chat-color>${COLORS.map(([id])=>`<option value="${id}" ${row.color===id?'selected':''}>${id[0].toUpperCase()+id.slice(1)}</option>`).join('')}</select><label><input type="checkbox" data-chat-enabled ${row.enabled?'checked':''}> On</label><button type="button" data-chat-delete aria-label="Delete highlight">×</button></div>`).join('');
        ui.setStatus('Custom chat buttons and term highlighting are stored on this device.','ready');
        ui.setContentHtml(`<div class="slink-chat-stack"><section class="slink-chat-card"><h3>Custom chat buttons</h3><p>Uses the existing two-click flow: first click loads the HTML message; second click sends it. Unquoted links are corrected to <span class="slink-chat-token">&lt;a href="link"&gt;</span>.</p><div class="slink-chat-actions"><button type="button" data-chat-manage>Manage custom buttons</button></div><p>Available tokens: <span class="slink-chat-token">{{page_link}}</span>, <span class="slink-chat-token">{{page_link:Label}}</span>, <span class="slink-chat-token">{{page_url}}</span>, and <span class="slink-chat-token">{{page_title}}</span>.</p></section><section class="slink-chat-card"><h3>Highlight chat terms</h3><p>Add a word or phrase and choose one of ten highlight colors. Matching is case-insensitive.</p><div data-chat-rows>${rows || '<p>No highlighted terms configured.</p>'}</div><div class="slink-chat-actions"><button type="button" data-chat-add>Add term</button><button type="button" data-chat-save>Save highlights</button></div></section></div>`);
        bind();
      }
      function bind() {
        const root=ui.getContentElement();
        root.querySelector('[data-chat-manage]')?.addEventListener('click',()=>global.dispatchEvent(new CustomEvent('slink-chat-open-editor')));
        root.querySelector('[data-chat-add]')?.addEventListener('click',()=>{settings.highlights.push({id:crypto.randomUUID?.()||String(Date.now()),term:'',color:'yellow',enabled:true});render();});
        root.querySelectorAll('[data-chat-delete]').forEach(button=>button.addEventListener('click',()=>{const id=button.closest('[data-chat-id]')?.dataset.chatId;settings.highlights=settings.highlights.filter(row=>row.id!==id);render();}));
        root.querySelector('[data-chat-save]')?.addEventListener('click',async()=>{
          settings=normalized({highlights:[...root.querySelectorAll('[data-chat-highlight-row]')].map(row=>({id:row.dataset.chatId,term:row.querySelector('[data-chat-term]').value,color:row.querySelector('[data-chat-color]').value,enabled:row.querySelector('[data-chat-enabled]').checked}))});
          await SLINK.core.storage.set(STORAGE_KEY,settings);clearHighlights();scanHighlights();render();
        });
      }
      render();
      observer=new MutationObserver(scheduleScan);observer.observe(document.body,{childList:true,subtree:true});scanHighlights();
      return {stop(){observer?.disconnect();observer=null;clearTimeout(scanTimer);}};
    }
  });
})(globalThis);
