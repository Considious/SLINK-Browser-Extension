(() => {
  'use strict';
  const {messaging,format}=globalThis.SLINK_EXTENSION.core;
  const form=document.querySelector('form'), fields=form.elements;
  const status=form.querySelector('[role=status]');
  const submit=form.querySelector('button:not([type])'), remove=form.querySelector('[data-remove]');
  let ready=false,busy=false;
  function buttons(){submit.disabled=busy||!ready;remove.disabled=busy;}
  async function load(){
    const preferences=await messaging.send('access.inPage.status');
    fields.tornKey.placeholder=preferences.hasTornKey?'Saved — leave blank to keep':'Enter a Torn API key';
    fields.ffKey.placeholder=preferences.hasFfKey?'Saved — leave blank to keep':'Optional, separate FFScouter key';
    for(const module of ['efficiency','war','leveling'])fields[module].checked=preferences[module]===true;
    const checks=[['SLINK API & Data Terms','access.status'],['War disclosure','war.terms'],['Leveling disclosure','leveling.terms']];
    const results=await Promise.allSettled(checks.map(([,route])=>messaging.send(route)));
    const links=[]; const shown=[];
    for(let i=0;i<results.length;i++){
      const terms=i===0?results[i].value?.terms:results[i].value;
      const target=terms?.documentUrl;
      if(typeof target!=='string')continue;
      let url;try{url=new URL(target);}catch{continue;}
      if(url.protocol!=='https:')continue;
      const link=document.createElement('a');
      link.href=url.href;link.target='_blank';link.rel='noopener noreferrer';
      link.textContent=checks[i][0];links.push(link);shown[i]=true;
      if(terms.summary){const copy=document.createElement('p');copy.textContent=terms.summary;links.push(copy);}
      if(typeof terms.disclosureUrl==='string'){
        let disclosure;try{disclosure=new URL(terms.disclosureUrl);}catch{continue;}
        if(disclosure.protocol==='https:'){
          const extra=link.cloneNode();extra.href=disclosure.href;extra.textContent=checks[i][0]+' (additional policy)';links.push(extra);
        }
      }
    }
    const termsRoot=form.querySelector('[data-terms]');
    termsRoot.replaceChildren(...links.flatMap((link,index)=>index?[' · ',link]:[link]));
    if(!links.length)termsRoot.textContent='Could not load the current terms. Reopen the editor to retry.';
    fields.acceptTerms.disabled=!links.length;
    ready=shown[0]===true;form.dataset.warTerms=String(shown[1]===true);form.dataset.levelingTerms=String(shown[2]===true);buttons();
  }
  async function save(payload){
    busy=true;buttons();status.textContent='Working…';
    try{
      await messaging.send('access.inPage.credentials',payload);
      fields.tornKey.value='';fields.ffKey.value='';fields.acceptTerms.checked=false;
      status.textContent=payload.clear?'Keys removed from this extension.':'Saved and verified.';
      await load();
    }catch(error){status.textContent=format.errorMessage(error);}
    finally{busy=false;buttons();}
  }
  form.addEventListener('submit',event=>{
    event.preventDefault();
    if(!event.isTrusted||!ready||busy)return;
    const acceptTerms=fields.acceptTerms.checked;
    if(acceptTerms&&((fields.war.checked&&form.dataset.warTerms!=='true')||(fields.leveling.checked&&form.dataset.levelingTerms!=='true'))){status.textContent='Could not display all selected module disclosures. Reopen the editor and try again.';return;}
    void save({tornKey:fields.tornKey.value,ffKey:fields.ffKey.value,acceptTerms,
      efficiency:fields.efficiency.checked,war:fields.war.checked,leveling:fields.leveling.checked});
  });
  remove.addEventListener('click',event=>{
    if(!event.isTrusted||busy)return;
    const confirmRow=form.querySelector('[data-confirm]');
    if(confirmRow.hidden||fields.confirmation.value!=='REMOVE'){
      confirmRow.hidden=false;fields.confirmation.focus();status.textContent='This removes locally saved API keys, not remote Public Only donations.';return;
    }
    confirmRow.hidden=true;fields.confirmation.value='';void save({clear:true});
  });
  void load().catch(error=>{status.textContent=format.errorMessage(error);buttons();});
})();
