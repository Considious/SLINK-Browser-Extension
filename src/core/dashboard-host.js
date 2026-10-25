(function installDashboardHost(global) {
  'use strict';
  const SLINK=global.SLINK_EXTENSION;
  function create({permissions,visible,root=document}) {
    let desired=null, running=null, revision=0, queue=Promise.resolve();
    const definition=id=>SLINK.modules.list().find(item=>item.id===id);
    const allowed=id=>SLINK.modules.canAccess(definition(id),permissions());
    function ui(id,panel,current) {
      const content=panel.querySelector('[data-host-content]');
      const set=(selector,value)=>{if(current()){const node=panel.querySelector(selector);if(node)node.textContent=String(value||'');}};
      return {
        getContentElement:()=>content,
        setTitle:value=>set('[data-host-title]',value),
        setSubtitle:value=>set('[data-host-subtitle]',value),
        setStatus(message,tone='normal') {
          if(!current())return;
          const node=panel.querySelector('[data-host-status]');
          node.textContent=String(message||'');node.hidden=!message;node.dataset.tone=tone;
        },
        setContentHtml(html){if(current())content.innerHTML=String(html||'');},
        setContentText(text){if(current())content.textContent=String(text||'');},
        setAlertCount(){},
        setActions(actions=[]) {
          if(!current())return;
          const holder=panel.querySelector('[data-host-actions]');holder.replaceChildren();
          for(const action of actions){
            const button=document.createElement('button');button.type='button';button.textContent=action.label;
            button.disabled=Boolean(action.disabled);button.dataset.hostAction=action.id||'';
            button.addEventListener('click',()=>{if(current())Promise.resolve().then(()=>action.onClick?.()).catch(error=>this.setStatus(SLINK.core.format.errorMessage(error),'error'));});
            holder.append(button);
          }
        },
        setModuleStyles(css) {
          let style=document.getElementById('slink-dashboard-module-'+id);
          if(!style){style=document.createElement('style');style.id='slink-dashboard-module-'+id;document.head.append(style);}
          style.textContent=String(css||'');
        },
        navigateTo(id) {
          if(!current()||id!=='war')return;
          global.open('https://www.torn.com/factions.php?step=your#/tab=armoury','_blank','noopener');
        }
      };
    }
    async function reconcile(ticket) {
      if(running){
        const previous=running;running=null;previous.scope.dispose();
        try{await previous.instance?.stop?.();}catch(error){console.error('[SLINK] Dashboard module cleanup:',previous.id,error);}
      }
      if(ticket!==revision||!desired||!visible()||!allowed(desired))return;
      const id=desired,panel=root.querySelector(`[data-host-module="${id}"]`);
      if(!panel)return;
      const current=()=>ticket===revision&&desired===id&&visible()&&allowed(id);
      const adapter=ui(id,panel,current);
      const scope=SLINK.modules.lifecycle({url:new URL('https://www.torn.com/'),permissions:permissions(),
        module:definition(id),presentation:'dashboard',ui:adapter,isActive:current});
      scope.context.listen(panel,'click',event=>{
        const link=event.target.closest?.('a[href]');
        if(link&&new URL(link.href,global.location.href).hostname==='www.torn.com'){link.target='_blank';link.rel='noopener noreferrer';}
      },true);
      running={scope,instance:null,id};
      try {
        const instance=await definition(id).start(scope.context);
        if(!current()){scope.dispose();await instance?.stop?.();if(running?.scope===scope)running=null;return;}
        running.instance=instance;
      } catch(error) {
        adapter.setStatus(SLINK.core.format.errorMessage(error),'error');scope.dispose();
        if(running?.scope===scope)running=null;
      }
    }
    function select(id) {
      desired=id||null;
      if(running?.id===desired&&visible()&&allowed(desired))return queue;
      const ticket=++revision;running?.scope.dispose();
      const task=queue.catch(()=>{}).then(()=>reconcile(ticket));queue=task;return task;
    }
    return Object.freeze({select,allowed,stop:()=>select(null)});
  }
  SLINK.define('core','dashboardHost',Object.freeze({create}));
})(globalThis);
