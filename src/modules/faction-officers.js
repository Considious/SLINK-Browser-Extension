(function registerFactionOfficerModule(global) {
  'use strict';
  const SLINK=global.SLINK_EXTENSION,CORE=SLINK.core.factionOfficers;
  const SCOPES=[CORE.OFFICER_SCOPE,CORE.ARMORY_SCOPE,CORE.OC_SCOPE];
  const LABELS={ [CORE.OFFICER_SCOPE]:'Onboarding',[CORE.ARMORY_SCOPE]:'Armory',[CORE.OC_SCOPE]:'OC' };
  const escape=value=>SLINK.core.format.escapeHtml(value);
  SLINK.modules.register({
    id:'faction-officers',title:'Faction Officers',shortTitle:'Officers',group:'quality-of-life',groupTitle:'Quality of Life',requiredScopes:[],
    permissionTest:permissions=>[CORE.ADMIN_SCOPE,...SCOPES].some(scope=>SLINK.core.permissions.hasScope(permissions,scope)),
    defaultShowInTorn:true,matches:url=>url.hostname==='www.torn.com',
    async start(context){
      const ui=context.ui,root=ui.getContentElement();
      let current=null,access=null,busy=false,stopped=false,accessSaving=false,settingsRevision=0,accessFaction=null,notice='',previewTimer=null;
      const controllers=new Map();
      const copying=new Set();
      const priorExplicit=root.dataset.uiExplicitCommit;root.dataset.uiExplicitCommit='true';
      const guard=SLINK.core.formState.protect(root.getRootNode?.()||root);
      root.innerHTML='<div class="slink-fo-stack"><p data-fo-notice role="status"></p><div data-fo-slot="recaller"></div><div data-fo-slot="armory"></div><div data-fo-slot="oc"></div><div data-fo-slot="access"></div></div>';
      const slot=kind=>root.querySelector('[data-fo-slot="'+kind+'"]');
      const setText=(node,value)=>{if(node&&node.textContent!==value)node.textContent=value;};
      ui.setModuleStyles('.slink-fo-stack{display:grid;gap:9px}.slink-fo-card{min-width:0;padding:9px;border:1px solid var(--slink-border-soft);border-radius:8px;background:var(--slink-bg-control)}.slink-fo-head{display:flex;gap:8px;align-items:flex-start;justify-content:space-between;flex-wrap:wrap}.slink-fo-head h3{margin:0}.slink-fo-head p{margin:3px 0 0;color:var(--slink-muted)}.slink-fo-head input[type=number]{width:75px}.slink-fo-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(200px,100%),1fr));gap:6px;margin-top:8px}.slink-fo-item{display:grid;grid-template-columns:minmax(0,1fr) 78px;align-items:center;gap:6px}.slink-fo-item input[type=number]{width:100%;min-width:0;box-sizing:border-box}.slink-fo-controls{display:flex;gap:7px;flex-wrap:wrap;align-items:center;margin-top:9px}.slink-fo-controls button{min-height:30px;padding:5px 9px;border:1px solid var(--slink-border);border-radius:6px;background:var(--slink-bg);color:var(--slink-text);font:inherit}.slink-fo-access{overflow:auto;max-height:360px}.slink-fo-access table{width:100%;border-collapse:collapse}.slink-fo-access th,.slink-fo-access td{padding:6px;border-bottom:1px solid var(--slink-border-soft);text-align:left;white-space:nowrap}.slink-fo-access th:not(:first-child),.slink-fo-access td:not(:first-child){text-align:center}.slink-fo-note{color:var(--slink-muted);font-size:11px}.slink-fo-results{margin-top:7px;color:var(--slink-muted);white-space:pre-wrap}');
      function allowed(){return !stopped&&!context.signal?.aborted;}
      function preview(){if(previewTimer)global.clearTimeout(previewTimer);if(!allowed())return;previewTimer=global.setTimeout(()=>{previewTimer=null;if(!busy&&![...controllers.values()].some(controller=>controller.busy))void load(false);},250);}
      function flat(settings){return {checksPerDay:settings?.checksPerDay,soundEnabled:settings?.soundEnabled,...Object.fromEntries(Object.entries(settings?.thresholds||{}).map(([key,value])=>['threshold:'+key,value]))};}
      function mountThresholds(kind){
        const defs=current.definitions[kind],config=current.settings[kind],holder=slot(kind);
        holder.innerHTML='<section class="slink-fo-card" data-fo-section="'+kind+'"><div class="slink-fo-head"><div><h3>'+(kind==='oc'?'Organized crime supplies':'Faction armory thresholds')+'</h3><p>'+(kind==='oc'?'Tracks OC stock and checks active assigned slots for missing required items.':'One consolidated alert lists every configured item below target.')+'</p></div><label>Checks/day <input id="fo-'+kind+'-frequency" type="number" min="0" max="24" step="1" data-fo-frequency="'+kind+'" value="'+config.checksPerDay+'"></label></div><p class="slink-fo-note"></p><div class="slink-fo-grid">'+defs.map(def=>'<label class="slink-fo-item"><span>'+escape(def.name)+'</span><input id="fo-'+kind+'-threshold-'+escape(def.key)+'" type="number" min="0" step="1" data-fo-threshold="'+kind+'" data-fo-key="'+escape(def.key)+'" value="'+(config.thresholds[def.key]||0)+'"></label>').join('')+'</div><div class="slink-fo-controls"><label><input id="fo-'+kind+'-sound" type="checkbox" data-fo-sound="'+kind+'" '+(config.soundEnabled?'checked':'')+'> Alert sound</label><button type="button" data-fo-action="run-'+kind+'">Run '+(kind==='oc'?'OC':'armory')+' check now</button><span data-fo-save-state role="status"></span><button type="button" data-fo-action="retry-'+kind+'" hidden>Retry</button></div><div class="slink-fo-results"></div></section>';
        holder.querySelector('.slink-fo-results').innerHTML='<p data-fo-result-summary></p><pre data-fo-restock></pre><button type="button" data-fo-action="copy-'+kind+'">Copy restock list</button>'+(kind==='oc'?'<pre data-fo-missing></pre><button type="button" data-fo-action="copy-missing">Copy missing-item list</button>':'')+'<p><a href="'+CORE.ARMORY_URL+'">Open faction armory</a>'+(kind==='oc'?' · <a href="'+CORE.CRIMES_URL+'">Open organized crimes</a>':'')+'</p><label data-fo-copy-fallback hidden>Copy manually<textarea readonly rows="4" data-fo-copy-text style="width:100%;min-width:0;box-sizing:border-box"></textarea></label>';
        holder.querySelectorAll('pre').forEach(node=>{node.style.cssText='white-space:pre-wrap;overflow-wrap:anywhere;font:inherit;margin:6px 0';});
        const fields={};
        fields['fo-'+kind+'-frequency']='checksPerDay';fields['fo-'+kind+'-sound']='soundEnabled';
        for(const def of defs)fields['fo-'+kind+'-threshold-'+def.key]='threshold:'+def.key;
        const controller=SLINK.core.formState.autosave({root:holder,fields,read:key=>flat(current?.settings?.[kind])[key],
          async save(patch){const next={};for(const [key,value]of Object.entries(patch)){if(key.startsWith('threshold:'))next.thresholds={[key.slice(10)]:value};else next[key]=value;}settingsRevision++;try{return await SLINK.core.messaging.send('faction.officer.settings.save',{[kind]:next});}finally{settingsRevision++;}},
          select:response=>flat(response.settings?.[kind]),
          onCommit:patch=>{const next={...current.settings[kind],thresholds:{...current.settings[kind].thresholds}};for(const[key,value]of Object.entries(patch)){if(key.startsWith('threshold:'))next.thresholds[key.slice(10)]=value;else next[key]=value;}current={...current,settings:{...current.settings,[kind]:next}};},
          onState:state=>{if(!allowed()||!current?.access?.[kind])return;setText(holder.querySelector('[data-fo-save-state]'),({idle:'Changes save automatically.',saving:'Saving…',saved:'Saved.',invalid:'Enter a complete number.',failed:'Not saved. Retry your changes.',unsaved:'Not saved yet.'})[state.state]||'');holder.querySelector('[data-fo-action="retry-'+kind+'"]').hidden=state.state!=='failed';if(state.state==='saved')preview();}
        });controllers.set(kind,controller);controller.mount();
      }
      function accessCard(){
        if(!current?.access?.admin||!access)return '';
        return '<section class="slink-fo-card"><div class="slink-fo-head"><div><h3>Officer role access</h3><p>Role assignments affect the faction and require Save role assignments. Individual grants remain managed on the permissions page.</p></div></div><div class="slink-fo-access"><table><thead><tr><th>Faction role</th>'+SCOPES.map(scope=>'<th>'+LABELS[scope]+'</th>').join('')+'</tr></thead><tbody></tbody></table></div><div class="slink-fo-controls"><button type="button" data-fo-action="save-access">Save role assignments</button></div></section>';
      }
      function renderAccess(){
        const holder=slot('access');
        if(!current?.access?.admin||!access){holder.replaceChildren();accessFaction=null;return;}
        if(accessFaction!==access.factionId){holder.innerHTML=accessCard();accessFaction=access.factionId;}
        const body=holder.querySelector('tbody'),present=new Set();
        for(const role of access.roles||[]){
          const key=String(role.name);present.add(key);
          let row=[...body.children].find(node=>node.dataset.foRole===key);
          if(!row){row=document.createElement('tr');row.dataset.foRole=key;row.innerHTML='<td><strong></strong><br><small></small></td>'+SCOPES.map((scope,index)=>{const id='slink-fo-role-'+access.factionId+'-'+encodeURIComponent(key)+'-'+index;return '<td><input id="'+escape(id)+'" name="'+escape(id)+'" type="checkbox" data-fo-grant="role" data-fo-id="'+escape(key)+'" data-fo-scope="'+scope+'" '+(role.scopes[scope]?'checked':'')+' aria-label="'+escape(key+': '+LABELS[scope])+'"></td>';}).join('');body.append(row);}
          setText(row.querySelector('strong'),key);setText(row.querySelector('small'),role.memberCount+' members');
        }
        for(const row of [...body.children])if(!present.has(row.dataset.foRole))row.remove();
        holder.querySelector('[data-fo-action="save-access"]').disabled=accessSaving;
      }
      function render(){
        if(!allowed())return;
        const message=root.querySelector('[data-fo-notice]');setText(message,notice||(!current?'Loading officer controls…':''));message.hidden=!message.textContent;
        if(!current)return;
        if(current.access.armory){if(!slot('recaller').firstChild)slot('recaller').innerHTML='<section class="slink-fo-card"><div class="slink-fo-head"><div><h3>Armory Recaller</h3><p>Manual ranked-item retrieval with the faction officer Armory permission.</p></div></div><div class="slink-fo-controls"><button type="button" data-fo-action="open-recaller">Open Armory Recaller</button><a href="https://www.torn.com/factions.php?step=your#/tab=armoury">Open faction armory</a></div></section>';}else slot('recaller').replaceChildren();
        for(const kind of ['armory','oc']){
          if(!current.access[kind]){const controller=controllers.get(kind);controllers.delete(kind);void controller?.stop();slot(kind).replaceChildren();continue;}
          if(!controllers.has(kind))mountThresholds(kind);
          const runtime=current.runtime,holder=slot(kind),last=kind==='armory'?runtime.lastArmoryCheckAt:runtime.lastOcCheckAt,error=kind==='armory'?runtime.armoryError:runtime.ocError,rows=kind==='armory'?runtime.armoryShortages:runtime.ocShortages;
          setText(holder.querySelector('.slink-fo-note'),(kind==='oc'?'Set 0 for manual checks only. ':'')+'Torn inventory is cached for one hour. Last check: '+(last?new Date(last).toLocaleString():'never')+'.');
          setText(holder.querySelector('[data-fo-result-summary]'),error?'Error: '+error+' Last available results are shown below.':(rows?.length||0)+' stock thresholds below target'+(kind==='oc'?' · '+(runtime.missingCrimeItems?.length||0)+' active crime slots missing items':'')+'.');
          const restock=holder.querySelector('[data-fo-restock]');setText(restock,rows?.length?CORE.restockMessage(kind==='armory'?'Restock Needed:':'OC Restock Needed:',rows):'');restock.hidden=!rows?.length;
          const copy=holder.querySelector('[data-fo-action="copy-'+kind+'"]');copy.hidden=!rows?.length;copy.disabled=copying.has(kind);
          if(kind==='oc'){
            const missing=runtime.missingCrimeItems||[],detail=holder.querySelector('[data-fo-missing]');setText(detail,missing.length?CORE.missingCrimeMessage(missing):'');detail.hidden=!missing.length;
            const button=holder.querySelector('[data-fo-action="copy-missing"]');button.hidden=!missing.length;button.disabled=copying.has('missing');
          }
          holder.querySelector('[data-fo-action="run-'+kind+'"]').disabled=busy;
        }
        renderAccess();
      }
      async function load(refreshIfDue=true,kind=''){
        if(busy||!allowed())return;busy=true;render();const revision=settingsRevision;
        try{
          const response=await SLINK.core.messaging.send(kind?'faction.officer.refresh':'faction.officer.status',kind?{kind}:{refreshIfDue});
          if(!allowed())return;
          current={...response,definitions:response.definitions||current?.definitions||{armory:CORE.ARMORY_ITEMS,oc:CORE.OC_ITEMS},settings:revision===settingsRevision&&![...controllers.values()].some(controller=>controller.busy)?response.settings:current?.settings||response.settings};
          if(!current.access.admin)access=null;
          else if(!access)access=await SLINK.core.messaging.send('faction.officer-access.status');
          if(allowed())ui.setStatus('Officer checks loaded.','ready');
        }catch(error){if(allowed()){notice=SLINK.core.format.errorMessage(error);ui.setStatus(notice,'error');}}
        finally{busy=false;render();}
      }
      async function saveAccess(){
        if(accessSaving||!allowed()||!current?.access?.admin||!access)return;
        const factionId=access.factionId;
        const assignments=Object.fromEntries(SCOPES.map(scope=>[scope,{roles:[],users:(access.users||[]).filter(user=>user.scopes?.[scope]).map(user=>({id:Number(user.id),name:user.name}))}]));
        const captures=[...slot('access').querySelectorAll('[data-fo-grant]')].map(control=>({control,ticket:guard?.begin(control),name:control.dataset.foId,scope:control.dataset.foScope}));
        for(const {control,name,scope}of captures)if(control.checked)assignments[scope].roles.push(name);
        accessSaving=true;notice='';render();
        try{
          const saved=await SLINK.core.messaging.send('faction.officer-access.save',{assignments});
          if(!Array.isArray(saved?.roles)||saved.factionId!==factionId)throw Error('Role assignments were not confirmed for this faction.');
          for(const {control,ticket,name,scope}of captures){const matching=saved.roles.find(role=>role.name===name);if(guard?.commit(ticket)&&allowed()&&current.access.admin&&accessFaction===factionId&&control.isConnected&&matching)control.checked=matching.scopes?.[scope]===true;}
          if(allowed()&&current.access.admin&&accessFaction===factionId){access=saved;notice='Officer role assignments saved.';}
        }catch(error){if(allowed())notice=SLINK.core.format.errorMessage(error);}
        finally{accessSaving=false;render();}
      }
      context.listen(root,'click',async event=>{
        if(!allowed())return;const button=event.target.closest('[data-fo-action]');if(!button)return;const action=button.dataset.foAction;
        if(action==='save-access'){void saveAccess();return;}
        if(['copy-armory','copy-oc','copy-missing'].includes(action)){
          const target=action.slice(5),kind=target==='missing'?'oc':target;
          if(!current?.access?.[kind]||copying.has(target))return;
          const runtime=current.runtime,rows=target==='missing'?runtime.missingCrimeItems:kind==='armory'?runtime.armoryShortages:runtime.ocShortages;
          if(!rows?.length)return;
          const error=kind==='armory'?runtime.armoryError:runtime.ocError;
          const text=(error?'Last available results; latest check failed.\n':'')+(target==='missing'?CORE.missingCrimeMessage(rows):CORE.restockMessage(kind==='armory'?'Restock Needed:':'OC Restock Needed:',rows));
          copying.add(target);button.disabled=true;
          try{
            const copied=await SLINK.core.clipboard.copyText(text);
            if(!allowed()||!current.access[kind])return;
            const holder=slot(kind),fallback=holder.querySelector('[data-fo-copy-fallback]');fallback.hidden=copied;
            if(!copied)holder.querySelector('[data-fo-copy-text]').value=text;
            notice=copied?'List copied. Paste it manually where needed.':'Copy blocked. Select and copy the list below.';
          }catch(error){if(allowed())notice=SLINK.core.format.errorMessage(error);}
          finally{copying.delete(target);if(allowed())render();}
          return;
        }
        if(action.startsWith('retry-')){void controllers.get(action.slice(6))?.retry().catch(()=>{});return;}
        if(action==='open-recaller'){if(!current?.access?.armory)return;try{await SLINK.core.storage.set('ui.war.requestedTab','armory');if(!allowed())return;global.dispatchEvent(new CustomEvent('slink:open-armory-recaller'));await ui.navigateTo?.('war');}catch(error){if(allowed()){notice=SLINK.core.format.errorMessage(error);render();}}return;}
        if(action.startsWith('run-')&&!busy){const kind=action.slice(4);try{await controllers.get(kind)?.flush();if(allowed()&&current.access[kind])await load(false,kind);}catch(error){if(allowed()){notice=SLINK.core.format.errorMessage(error);render();}}}
      });
      await load(true);
      return{async stop(){stopped=true;if(previewTimer)global.clearTimeout(previewTimer);await Promise.all([...controllers.values()].map(controller=>controller.stop()));if(priorExplicit===undefined)delete root.dataset.uiExplicitCommit;else root.dataset.uiExplicitCommit=priorExplicit;}};
    }
  });
})(globalThis);
