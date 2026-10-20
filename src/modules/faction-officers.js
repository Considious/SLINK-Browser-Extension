(function registerFactionOfficerModule(global) {
  'use strict';
  const SLINK=global.SLINK_EXTENSION, CORE=SLINK.core.factionOfficers;
  const SCOPES=[CORE.OFFICER_SCOPE,CORE.ARMORY_SCOPE,CORE.OC_SCOPE];
  const LABELS={ [CORE.OFFICER_SCOPE]:'Onboarding', [CORE.ARMORY_SCOPE]:'Armory', [CORE.OC_SCOPE]:'OC' };
  SLINK.modules.register({
    id:'faction-officers',title:'Faction Officers',shortTitle:'Officers',group:'quality-of-life',groupTitle:'Quality of Life',requiredScopes:[],
    permissionTest:permissions=>[CORE.ADMIN_SCOPE,...SCOPES].some(scope=>SLINK.core.permissions.hasScope(permissions,scope)),
    defaultShowInTorn:true,matches:url=>url.hostname==='www.torn.com',
    async start(context){
      const ui=context.ui;let current=null,access=null,busy=false;
      ui.setModuleStyles(`
        .slink-fo-stack{display:grid;gap:9px}.slink-fo-card{padding:9px;border:1px solid var(--slink-border-soft);border-radius:8px;background:var(--slink-bg-control)}
        .slink-fo-head{display:flex;gap:8px;align-items:flex-start;justify-content:space-between}.slink-fo-head h3{margin:0}.slink-fo-head p{margin:3px 0 0;color:var(--slink-muted)}
        .slink-fo-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(145px,1fr));gap:6px;margin-top:8px}.slink-fo-item{display:grid;grid-template-columns:minmax(0,1fr) 78px;align-items:center;gap:6px}
        .slink-fo-item input[type=number]{width:100%;min-width:0;box-sizing:border-box}.slink-fo-controls{display:flex;gap:7px;flex-wrap:wrap;align-items:center;margin-top:9px}
        .slink-fo-controls button{min-height:30px;padding:5px 9px;border:1px solid var(--slink-border);border-radius:6px;background:var(--slink-bg);color:var(--slink-text);font:inherit}
        .slink-fo-access{overflow:auto;max-height:360px}.slink-fo-access table{width:100%;border-collapse:collapse}.slink-fo-access th,.slink-fo-access td{padding:6px;border-bottom:1px solid var(--slink-border-soft);text-align:left;white-space:nowrap}.slink-fo-access th:not(:first-child),.slink-fo-access td:not(:first-child){text-align:center}
        .slink-fo-note{color:var(--slink-muted);font-size:11px}.slink-fo-results{margin-top:7px;color:var(--slink-muted);white-space:pre-wrap}
      `);
      async function load(refreshIfDue=true){busy=true;render();try{current=await SLINK.core.messaging.send('faction.officer.status',{refreshIfDue});if(current.access.admin)access=await SLINK.core.messaging.send('faction.officer-access.status');ui.setStatus('Officer checks loaded.','ready');}catch(e){ui.setStatus(SLINK.core.format.errorMessage(e),'error');}finally{busy=false;render();}}
      function thresholdCard(kind,title,description){
        if(!current?.access?.[kind])return '';
        const settings=current.settings[kind],runtime=current.runtime,defs=current.definitions[kind];
        const lastAt=kind==='armory'?runtime.lastArmoryCheckAt:runtime.lastOcCheckAt;
        const error=kind==='armory'?runtime.armoryError:runtime.ocError;
        const rows=kind==='armory'?runtime.armoryShortages:runtime.ocShortages;
        const missing=kind==='oc'?runtime.missingCrimeItems:[];
        return `<section class="slink-fo-card" data-fo-section="${kind}"><div class="slink-fo-head"><div><h3>${title}</h3><p>${description}</p></div><label>Checks/day <input type="number" min="0" max="24" step="1" data-fo-frequency="${kind}" value="${settings.checksPerDay}"></label></div>
        <p class="slink-fo-note">${kind==='oc'?'Set 0 for manual checks only. ':''}Torn inventory is cached for one hour. Last check: ${lastAt?new Date(lastAt).toLocaleString():'never'}.</p>
        <div class="slink-fo-grid">${defs.map(def=>`<label class="slink-fo-item"><span>${SLINK.core.format.escapeHtml(def.name)}</span><input type="number" min="0" step="1" data-fo-threshold="${kind}" data-fo-key="${def.key}" value="${settings.thresholds[def.key]||0}"></label>`).join('')}</div>
        <div class="slink-fo-controls"><label><input type="checkbox" data-fo-sound="${kind}" ${settings.soundEnabled?'checked':''}> Alert sound</label><button type="button" data-fo-action="save-${kind}">Save settings</button><button type="button" data-fo-action="run-${kind}" ${busy?'disabled':''}>Run ${kind==='oc'?'OC':'armory'} check now</button></div>
        <div class="slink-fo-results">${error?'Error: '+SLINK.core.format.escapeHtml(error):`${rows?.length||0} stock thresholds below target${kind==='oc'?` · ${missing?.length||0} active crime slots missing items`:''}.`}</div></section>`;
      }
      function accessCard(){
        if(!current?.access?.admin||!access)return '';
        const headers=SCOPES.map(scope=>`<th>${LABELS[scope]}</th>`).join('');
        const roleRows=(access.roles||[]).map(role=>`<tr><td><strong>${SLINK.core.format.escapeHtml(role.name)}</strong><br><small>${role.memberCount} members</small></td>${SCOPES.map(scope=>`<td><input type="checkbox" data-fo-grant="role" data-fo-id="${SLINK.core.format.escapeHtml(role.name)}" data-fo-scope="${scope}" ${role.scopes[scope]?'checked':''}></td>`).join('')}</tr>`).join('');
        const userRows=(access.users||[]).map(user=>`<tr><td>${SLINK.core.format.escapeHtml(user.name)} [${user.id}]<br><small>${SLINK.core.format.escapeHtml(user.position)}</small></td>${SCOPES.map(scope=>`<td><input type="checkbox" data-fo-grant="user" data-fo-id="${user.id}" data-fo-name="${SLINK.core.format.escapeHtml(user.name)}" data-fo-scope="${scope}" ${user.scopes[scope]?'checked':''}></td>`).join('')}</tr>`).join('');
        return `<section class="slink-fo-card"><div class="slink-fo-head"><div><h3>Officer access assignments</h3><p>Grant each officer feature by Torn role or by named faction member.</p></div></div><div class="slink-fo-access"><table><thead><tr><th>Faction role</th>${headers}</tr></thead><tbody>${roleRows}</tbody></table><table><thead><tr><th>Named member</th>${headers}</tr></thead><tbody>${userRows}</tbody></table></div><div class="slink-fo-controls"><button type="button" data-fo-action="save-access">Save access assignments</button></div></section>`;
      }
      function render(){
        const root=ui.getContentElement();if(!current){root.innerHTML='<p>Loading officer controls…</p>';return;}
        root.innerHTML=`<div class="slink-fo-stack">${current?.access?.armory?`<section class="slink-fo-card"><div class="slink-fo-head"><div><h3>Armory Recaller</h3><p>Manual ranked-item retrieval, available with the faction officer Armory permission.</p></div></div><div class="slink-fo-controls"><button type="button" data-fo-action="open-recaller">Open Armory Recaller</button><a href="https://www.torn.com/factions.php?step=your#/tab=armoury">Open faction armory</a></div></section>`:''}${thresholdCard('armory','Faction armory thresholds','One consolidated alert lists every configured item below target.')}${thresholdCard('oc','Organized crime supplies','Tracks OC stock and checks active assigned slots for missing required items.')}${accessCard()}</div>`;
        root.onclick=async event=>{const button=event.target.closest('[data-fo-action]');if(!button)return;const action=button.dataset.foAction;
          if(action==='open-recaller'){await SLINK.core.storage.set('ui.war.requestedTab','armory');global.dispatchEvent(new CustomEvent('slink:open-armory-recaller'));ui.navigateTo?.('war');return;}
          try{busy=true;button.disabled=true;
            if(action==='save-access'){const assignments=Object.fromEntries(SCOPES.map(scope=>[scope,{roles:[],users:[]}]));
              root.querySelectorAll('[data-fo-grant]:checked').forEach(input=>{const row=assignments[input.dataset.foScope];if(input.dataset.foGrant==='role')row.roles.push(input.dataset.foId);else row.users.push({id:Number(input.dataset.foId),name:input.dataset.foName});});
              access=await SLINK.core.messaging.send('faction.officer-access.save',{assignments});ui.setStatus('Officer access assignments saved.','ready');
            }else{const kind=action.endsWith('oc')?'oc':'armory';
              if(action.startsWith('save-')){const thresholds={};root.querySelectorAll(`[data-fo-threshold="${kind}"]`).forEach(input=>thresholds[input.dataset.foKey]=input.value);
                current=await SLINK.core.messaging.send('faction.officer.settings.save',{[kind]:{checksPerDay:root.querySelector(`[data-fo-frequency="${kind}"]`)?.value,soundEnabled:root.querySelector(`[data-fo-sound="${kind}"]`)?.checked!==false,thresholds}});ui.setStatus('Officer check settings saved.','ready');
              }else{current=await SLINK.core.messaging.send('faction.officer.refresh',{kind});ui.setStatus(kind==='oc'?'OC check completed.':'Armory check completed.','ready');}
            }
          }catch(e){ui.setStatus(SLINK.core.format.errorMessage(e),'error');}finally{busy=false;render();}
        };
      }
      await load(true);return{stop(){}};
    }
  });
})(globalThis);
