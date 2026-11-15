(function installMarketWatchEditor(g){
  'use strict';
  const core=g.SLINK_EXTENSION.core;
  const currency=value=>Number(value).toLocaleString('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0});
  function watchInput(fields,uid,newUid){
    const marketType=fields.type.value==='points'?'points':'item';
    const itemId=marketType==='item'?Number(fields.itemId.value):0;
    const maxPrice=Number(fields.price.value);
    if(!Number.isSafeInteger(maxPrice)||maxPrice<=0)throw Error('Enter a positive whole-dollar price.');
    if(marketType==='item'&&(!Number.isSafeInteger(itemId)||itemId<=0))throw Error('Choose a Torn item from the results.');
    if(marketType==='item'&&!fields.market.checked&&!fields.bazaar.checked)throw Error('Select Item Market, Weaver Bazaar, or both.');
    return { uid:uid||newUid(),requireExisting:!!uid,marketType,itemId,maxPrice,
      priority:core.market.normalizePriority(fields.priority.value),enabled:fields.enabled.checked,
      marketEnabled:marketType==='points'||fields.market.checked,bazaarEnabled:marketType==='item'&&fields.bazaar.checked };
  }

  function mount(host,{active,send,listen}){
    host.innerHTML=`<details><summary>Saved Market Watches</summary>
      <p data-watch-status></p>
      <button type="button" data-new hidden>New watch</button>
      <form hidden>
        <fieldset>
          <legend>Watch details</legend>
          <label>Watch type <select name="type"><option value="item">Item</option><option value="points">Points</option></select></label>
          <div data-items>
            <label>Search items <input name="query" type="search" placeholder="Name or item ID"></label>
            <label>Torn item <select name="itemId" aria-label="Torn item"></select></label>
            <button type="button" data-load-catalog>Load item list</button>
          </div>
          <label>Maximum price per unit <input name="price" type="number" min="1" step="1" required></label>
          <label>Check priority <select name="priority"><option value="high">High</option><option value="normal">Normal</option><option value="low">Low</option></select></label>
          <div data-sources><label>Item Market <input name="market" type="checkbox"></label><label>Weaver Bazaar <input name="bazaar" type="checkbox"></label></div>
          <label>Watch enabled <input name="enabled" type="checkbox" role="switch"></label>
          <div class="access-actions"><button type="submit">Save watch</button><button type="button" data-cancel>Cancel</button></div>
        </fieldset>
      </form>
      <p data-watch-note role="status"></p>
      <div data-watch-list></div>
    </details>`;
    const $=selector=>host.querySelector(selector), details=$('details'), form=$('form'), fields=form.elements;
    const fieldset=$('fieldset'), note=$('[data-watch-note]'), list=$('[data-watch-list]');
    let state,items=[],selected=null,editUid='',revision=0,pending=false,formMode=false;
    const available=()=>active()&&details.open;
    const option=(id,label)=>{const el=document.createElement('option');el.value=id;el.textContent=label;return el;};
    const btn=(name,label,uid='')=>{const el=document.createElement('button');el.type='button';el.dataset[name]=uid;el.textContent=label;return el;};
    function itemOptions(){
      const q=fields.query.value.trim().toLowerCase();
      const results=q?items.filter(row=>row.name.toLowerCase().includes(q)||String(row.id)===q).slice(0,30):[];
      const preferred=selected?results.filter(row=>row.id!==selected.id):results;
      fields.itemId.replaceChildren(option('',q?'Choose an item':'Search to find an item'),...(selected?[option(selected.id,selected.name)]:[]),...preferred.map(row=>option(row.id,row.name)));
      fields.itemId.value=selected?String(selected.id):'';
      $('[data-load-catalog]').hidden=items.length>0;
    }
    function syncFields(){
      const points=fields.type.value==='points';
      $('[data-items]').hidden=points;
      $('[data-sources]').hidden=points;
      fields.itemId.required=!points;
    }
    function render(){
      const allowed=state?.permitted===true;
      $('[data-watch-status]').textContent=allowed
        ? state.activeCount+'/'+state.limit+' active slots used, including Weaver price-list selections.'
        : 'An active Market Watch tier is required to add or edit. Saved watches can still be removed.';
      $('[data-new]').hidden=!allowed||formMode;
      form.hidden=!allowed||!formMode;
      fieldset.disabled=pending||!allowed;
      list.replaceChildren();
      if(!state?.watches?.length){list.textContent='No Market Watches saved on this installation.';return;}
      for(const watch of state.watches){
        const row=document.createElement('div');row.className='access-actions';
        const label=document.createElement('span');label.textContent=watch.label+' · '+currency(watch.maxPrice)+(watch.enabled?'':' · off');
        const remove=btn('remove', 'Remove', watch.uid);remove.setAttribute('aria-label','Remove watch for '+watch.label);
        row.append(label);
        if(allowed){
          const edit=btn('editWatch','Edit',watch.uid);edit.setAttribute('aria-label','Edit watch for '+watch.label);row.append(edit);
          const toggle=btn('toggleWatch',watch.enabled?'Disable':'Enable',watch.uid);toggle.setAttribute('aria-label',(watch.enabled?'Disable':'Enable')+' watch for '+watch.label);row.append(toggle);
        }
        row.append(remove);list.append(row);
      }
    }
    async function refresh({loadCatalog=false,includeCatalog=false}={}){
      if(!available())return;
      const run=++revision;
      const data=await send('market.watch.editor',{loadCatalog,includeCatalog:includeCatalog||loadCatalog});
      if(!available()||run!==revision)return;
      state=data;
      if(Array.isArray(data.items)){items=data.items.filter(row=>Number.isSafeInteger(row.id)&&typeof row.name==='string');itemOptions();}
      render();
    }
    const report=error=>{if(available())note.textContent=core.format.errorMessage(error);};
    const reload=()=>refresh().catch(report);
    async function act(work,message=''){
      if(!available()||pending)return;
      pending=true;fieldset.disabled=true;note.textContent='';
      try{await work();if(message&&available())note.textContent=message;}
      catch(error){report(error);}
      finally{pending=false;fieldset.disabled=state?.permitted!==true;}
    }
    function open(watch){
      if(!state?.permitted)return;
      editUid=watch?.uid||'';formMode=true;note.textContent='';
      fields.type.value=watch?.marketType||'item';
      fields.price.value=watch?.maxPrice??'';
      fields.priority.value=core.market.normalizePriority(watch?.priority||state.lastPriority);
      fields.enabled.checked=watch?.enabled!==false;fields.market.checked=watch?.marketEnabled!==false;fields.bazaar.checked=watch?.bazaarEnabled!==false;
      selected=watch?.itemId?{id:watch.itemId,name:watch.label}:null;fields.query.value='';
      itemOptions();syncFields();render();
      (watch?fields.price:fields.type).focus();
    }
    listen(details,'toggle',reload);
    listen(fields.type,'change',syncFields);
    listen(fields.query,'input',event=>{if(event.isTrusted){selected=null;itemOptions();}});
    listen(fields.itemId,'change',event=>{
      if(!event.isTrusted)return;
      const id=Number(fields.itemId.value);
      selected=id===selected?.id?selected:items.find(row=>row.id===id)||null;
    });
    listen(host,'click',event=>{
      const button=event.target.closest('button');if(!event.isTrusted||!button||pending)return;
      const watch=uid=>state?.watches.find(row=>row.uid===uid);
      if(button.matches('[data-new],[data-edit-watch]')){
        open(watch(button.dataset.editWatch));
        if(!items.length)void refresh({includeCatalog:true}).catch(report);
      }else if(button.matches('[data-cancel]')){
        formMode=false;render();$('[data-new]').focus();
      }else if(button.matches('[data-load-catalog]')){
        void act(async()=>{await refresh({loadCatalog:true});fields.query.focus();});
      }else if(button.matches('[data-toggle-watch]')){
        const current=watch(button.dataset.toggleWatch);
        if(current)void act(async()=>{await send('market.watch.toggle',{uid:current.uid,enabled:!current.enabled});await refresh();},'Watch updated.');
      }else if(button.matches('[data-remove]')&&g.confirm('Remove this saved Market Watch?')){
        void act(async()=>{
          await send('market.watch.removeSaved',{uid:button.dataset.remove});
          if(editUid===button.dataset.remove)formMode=false;
          await refresh();
        },'Watch removed.');
      }
    });
    listen(form,'submit',event=>{
      event.preventDefault();if(!event.isTrusted||!state?.permitted||!formMode)return;
      void act(async()=>{
        const input=watchInput(fields,editUid,()=>('watch-'+g.crypto.randomUUID()));
        await send('market.watch.save',input);
        formMode=false;await refresh();$('[data-new]').focus();
      },'Watch saved.');
    });
    return {refresh:reload};
  }
  g.SLINK_MARKET_WATCH_EDITOR=Object.freeze({mount,watchInput});
})(globalThis);
