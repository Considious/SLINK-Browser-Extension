(function (g) {
  'use strict';
  const SLINK=g.SLINK_EXTENSION;
  const {storage, messaging, themes, format} = SLINK.core;
  const send = (...args) => messaging.send(...args);
  const launcherKey = 'ui.main.minimizedMode';
  SLINK.modules.register({
    id:'access', title:'Access', group:'access', groupTitle:'Access',
    start(context) {
      const {ui} = context;
      ui.setStatus('');
      ui.setModuleStyles(`
        .slink-access{display:grid;gap:8px;min-inline-size:0}
        .slink-access section{background:var(--slink-card,var(--slink-bg));color:var(--slink-text);border:1px solid var(--slink-border);border-radius:8px;padding:8px;min-inline-size:0;overflow-wrap:anywhere}
        .slink-access h2{font-size:1.08em;margin:0 0 5px}.slink-access p{margin:4px 0}
        .slink-access label{display:flex;align-items:center;justify-content:space-between;gap:6px;margin:5px 0}
        .slink-access select{max-inline-size:55%;min-inline-size:0;background:var(--slink-control,var(--slink-bg));color:var(--slink-text);border:1px solid var(--slink-border);border-radius:4px;padding:3px}
        .slink-access .access-actions{display:flex;flex-wrap:wrap;gap:5px;margin-block:6px}
        .slink-access :focus-visible{outline:2px solid var(--slink-accent);outline-offset:2px}
        .slink-access iframe{display:block;inline-size:100%;block-size:340px;border:1px solid var(--slink-border);border-radius:6px;max-inline-size:100%}
      `);
      ui.setContentHtml(`
        <div class="slink-access">
          <section><h2>API &amp; feature access</h2><p data-key-state role="status">Checking local access…</p>
            <div class="access-actions"><button type="button" data-edit aria-expanded="false">Manage API keys</button>
              <button type="button" data-verify>Refresh permissions</button><button type="button" data-dashboard>Open standalone dashboard</button></div>
            <div data-credentials></div><p data-notice role="status"></p></section>
          <section><h2>Modules</h2><p>Pausing a module keeps its tab and saved settings.</p>
            <label>War <input type="checkbox" role="switch" data-module="war" disabled></label>
            <label>Leveling <input type="checkbox" role="switch" data-module="leveling" disabled></label>
            <label>Efficiency alerts <input type="checkbox" role="switch" data-module="alerts" disabled></label>
            <label>Target List <input type="checkbox" role="switch" data-module="target-list" disabled></label>
            <label>Player Stats <input type="checkbox" role="switch" data-module="player-stats" disabled></label>
            <label>Abroad Stocks <input type="checkbox" role="switch" data-module="abroad-stocks" disabled></label>
            <label>Bounties <input type="checkbox" role="switch" data-module="bounties" disabled></label>
            <label>Racing <input type="checkbox" role="switch" data-module="racing" disabled></label>
            <label>Company <input type="checkbox" role="switch" data-module="company" disabled></label>
            <label>Museums <input type="checkbox" role="switch" data-module="museums" disabled></label>
            <label>Money &amp; Property <input type="checkbox" role="switch" data-module="money-property" disabled></label>
            <label>Events <input type="checkbox" role="switch" data-module="events" disabled></label>
            <label>Market Watch checks <input type="checkbox" role="switch" data-module="market" disabled></label>
            <label>Mugging checks <input type="checkbox" role="switch" data-module="mugging" disabled></label>
            <label>Merit checks <input type="checkbox" role="switch" data-module="merits" disabled></label>
            <label>$1 Bazaar checks <input type="checkbox" role="switch" data-module="dollarBazaars" disabled></label></section>
          <section data-appearance><h2>Appearance</h2>
            <label>SLINK theme <select data-theme disabled></select></label>
            <label>Panel opacity <input data-opacity type="range" min="30" max="100" step="1" aria-label="Panel opacity" disabled></label>
            <label>Higher contrast <input type="checkbox" role="switch" data-contrast></label>
            <label>Minimized launcher <select data-launcher disabled><option value="bubble">Floating bubble</option><option value="chat">Torn chat bar</option></select></label>
          </section>
          <section data-usage aria-label="Torn API usage"><h2>Torn API usage</h2><p>Waiting for a usage snapshot…</p></section>
        </div>`);
      const root=ui.getContentElement(), $=selector=>root.querySelector(selector);
      const view=root.closest('.module-view'), shell=root.closest('.window');
      const theme=$('[data-theme]'), opacity=$('[data-opacity]'), launcher=$('[data-launcher]');
      const notice=$('[data-notice]'), usage=$('[data-usage]');
      let timer, watching=false, revision=0, previousHtml, hydrated=false, loading=false, writing=false, disposed=false, themePanel;
      const active=()=>!disposed&&context.isActive()&&!view?.hidden&&!shell?.hidden&&document.visibilityState==='visible';
      const renderModules=state=>{
        for(const input of root.querySelectorAll('[data-module]')){
          input.checked=state[input.dataset.module]===true;
          input.disabled=input.dataset.module==='mugging'&&!state.muggingAvailable;
        }
      };
      async function hydrate(){
        if(loading)return;
        loading=true;
        try{
          const [prefs, id, alpha, mode]=await Promise.all([
            send('access.inPage.status'),storage.get(themes.STORAGE_KEY,themes.DEFAULT_THEME_ID),
            storage.get(themes.PANEL_OPACITY_STORAGE_KEY,themes.DEFAULT_PANEL_OPACITY),storage.get(launcherKey,'bubble')
          ]);
          if(!active())return;
          const catalog=themes.list(prefs.permissions);
          theme.replaceChildren(...catalog.map(entry=>{
            const option=document.createElement('option');option.value=entry.id;
            option.textContent=entry.label+(entry.unlocked?'':' (locked)');option.disabled=!entry.unlocked;return option;
          }));
          theme.value=catalog.some(entry=>entry.unlocked&&entry.id===id)?id:themes.DEFAULT_THEME_ID;
          opacity.value=String(alpha);opacity.title=alpha+'%';
          launcher.value=mode==='chat'?'chat':'bubble';
          for(const control of [theme,opacity,launcher])control.disabled=false;
          $('[data-key-state]').textContent=prefs.authenticated?'Permissions verified.':prefs.hasTornKey?'Torn key saved. Refresh permissions to verify access.':'No Torn API key saved.';
          renderModules({...prefs.modules,muggingAvailable:SLINK.core.permissions.hasScope(prefs.permissions,'slink.mugging')});
          hydrated=true;
        }catch(error){if(active())notice.textContent=format.errorMessage(error);}
        finally{loading=false;}
      }
      async function update(run){
        if(run!==revision||!active())return;
        try{
          const data=await send('tornApi.accessUsage');
          if(run!==revision||!active())return;
          const markup=g.SLINK_ACCESS_USAGE.html(data);
          if(previousHtml!==markup){
            const expanded=usage.querySelector('details')?.open;
            usage.innerHTML=markup;previousHtml=markup;
            const details=usage.querySelector('details');if(details&&expanded)details.open=true;
          }
        }catch{/* Retain the last usable local snapshot. */}
        if(run===revision&&active())timer=g.setTimeout(()=>void update(run),10000);
      }
      function sync(){
        if(!active()){
          if(watching){
            watching=false;revision++;g.clearTimeout(timer);
            $('[data-credentials]').replaceChildren();$('[data-edit]').setAttribute('aria-expanded','false');
          }
          return;
        }
        if(watching)return;
        watching=true;
        void hydrate();
        if(!themePanel&&g.SLINK_TORN_THEME){
          themePanel=g.SLINK_TORN_THEME.mountSettings($('[data-appearance]'),{read:()=>send('themes.torn.get'),patch:changes=>send('themes.torn.patch',changes)});
        }
        void update(++revision);
      }
      async function action(control, fn){
        if(!active()||writing)return;
        writing=true;control.disabled=true;notice.textContent='';
        try{await fn();}
        catch(error){if(!disposed)notice.textContent=format.errorMessage(error);await hydrate();}
        finally{writing=false;if(control.dataset.module!=='mugging'||control.checked)control.disabled=false;else void hydrate();}
      }
      context.listen(root,'change',event=>{
        const control=event.target;
        if(!event.isTrusted||!hydrated)return;
        if(control===theme||control===opacity||control===launcher)void action(control,async()=>{
          const key=control===theme?themes.STORAGE_KEY:control===opacity?themes.PANEL_OPACITY_STORAGE_KEY:launcherKey;
          await storage.set(key,control===opacity?Number(control.value):control.value);
          if(control===opacity)opacity.title=opacity.value+'%';
        });
        if(control.matches('[data-module]'))void action(control,async()=>{
          const enabled=control.checked;
          await send('access.inPage.module',{module:control.dataset.module,enabled});
          notice.textContent=enabled?'Module enabled.':'Module paused. Saved settings were kept.';
        });
      });
      context.listen(root,'click',event=>{
        if(!event.isTrusted)return;
        const control=event.target.closest('button');
        if(!control)return;
        if(control.matches('[data-edit]')){
          const container=$('[data-credentials]');
          if(container.firstChild){container.replaceChildren();control.setAttribute('aria-expanded','false');void hydrate();return;}
          // Never put keys into the page's document or its open shadow root.
          const frame=document.createElement('iframe');frame.title='SLINK private API key settings';
          frame.src=chrome.runtime.getURL('src/access/credentials.html');
          container.append(frame);control.setAttribute('aria-expanded','true');
        }else if(control.matches('[data-verify]')){
          void action(control,async()=>{
            await send('access.inPage.verify');await hydrate();
            notice.textContent='Permissions refreshed.';
          });
        }else if(control.matches('[data-dashboard]'))void action(control,()=>send('ui.dashboard.open',{page:'access'}));
      });
      g.SLINK_THEME_APPEARANCE?.attach(ui.host,ui.host.shadowRoot)?.bind($('[data-contrast]'));
      const observer=new MutationObserver(sync);
      for(const element of [view,shell])if(element)observer.observe(element,{attributes:true,attributeFilter:['hidden']});
      context.listen(document,'visibilitychange',sync);
      const refreshKeys=['permissions.snapshot','access.settings.v1','access.session.v1','market.settings.v1','mugging.settings.v1','ui.monitoring.war.enabled','ui.monitoring.leveling.enabled','ui.monitoring.alerts.enabled','ui.monitoring.target-list.enabled','ui.monitoring.player-stats.enabled','ui.monitoring.abroad-stocks.enabled','ui.monitoring.bounties.enabled','ui.monitoring.racing.enabled','ui.monitoring.company.enabled','ui.monitoring.museums.enabled','ui.monitoring.money-property.enabled','ui.monitoring.events.enabled','ui.monitoring.merits.enabled','ui.monitoring.dollarBazaars.enabled',themes.STORAGE_KEY,themes.PANEL_OPACITY_STORAGE_KEY,launcherKey];
      const storageListener=(changes,area)=>{
        if(area==='local'&&active()&&!writing&&refreshKeys.some(key=>Object.hasOwn(changes,storage.fullKey(key))))void hydrate();
      };
      chrome.storage.onChanged.addListener(storageListener);
      sync();
      return {stop(){disposed=true;revision++;g.clearTimeout(timer);observer.disconnect();chrome.storage.onChanged.removeListener(storageListener);$('[data-credentials]').replaceChildren();void themePanel?.stop();}};
    }
  });
})(globalThis);
