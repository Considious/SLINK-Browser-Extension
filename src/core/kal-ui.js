(function installKalUi(global) {
  'use strict';
  if(global.SLINK_KAL_UI)return;
  const K=global.SLINK_KAL;
  const attribution='Loadout intelligence provided by KAL — Kalends [2032147]';
  function element(doc,tag,text) {const node=doc.createElement(tag);if(text!=null)node.textContent=text;return node;}
  function button(doc,text,work) {const node=element(doc,'button',text);node.type='button';node.addEventListener('click',work);return node;}
  function mountSettings(root,client) {
    if(root.dataset.kalMounted)return;root.dataset.kalMounted='true';
    const doc=root.ownerDocument;
    root.style.cssText='display:grid;gap:8px;min-width:0;';
    root.append(element(doc,'h3','KAL — Loadout Intelligence'));
    root.append(element(doc,'p','Connect your registered KAL account to view equipment intelligence on player profiles. Equipment collection remains with the official KAL script.'));
    const label=element(doc,'label','KAL API Key'), input=element(doc,'input');input.type='password';input.autocomplete='off';input.maxLength=16;input.setAttribute('aria-label','KAL API Key');label.append(input);root.append(label);
    const consentLabel=element(doc,'label'),consent=element(doc,'input');consent.type='checkbox';consentLabel.append(consent,doc.createTextNode(' Send this registered key only to KAL to validate and use my account. Register and accept policies on KAL’s website first.'));root.append(consentLabel);
    const status=element(doc,'p');status.setAttribute('role','status');
    const controls=element(doc,'div'),displayLabel=element(doc,'label','Equipment display '),display=element(doc,'select');controls.style.cssText='display:flex;flex-wrap:wrap;gap:6px;';
    for(const [value,text]of [['manual','Open SLINK equipment manually'],['slink','Use SLINK equipment panel'],['official','Use official KAL display']]){const option=element(doc,'option',text);option.value=value;display.append(option);}displayLabel.append(display);root.append(displayLabel);
    let state=null,busy=false;
    const show=value=>{state=value;display.value=value.display;enable.textContent=value.enabled?'Disable integration':'Enable integration';status.textContent=(value.connected?'KAL key validated. ':'Not connected. ')+(value.enabled?'Integration enabled.':'Integration disabled.');};
    async function run(work){if(busy)return;busy=true;for(const b of controls.querySelectorAll('button'))b.disabled=true;try{show(await work());root.dispatchEvent(new Event('kal-settings-changed',{bubbles:true}));}catch(error){status.textContent=error.message;}finally{busy=false;for(const b of controls.querySelectorAll('button'))b.disabled=false;}}
    const connect=button(doc,'Connect / Validate',()=>run(async()=>{const key=input.value;input.value='';return client.connect(key,consent.checked);}));
    const enable=button(doc,'Enable integration',()=>run(()=>client.configure({enabled:!state?.enabled,display:display.value})));
    const disconnect=button(doc,'Disconnect / Clear key',()=>run(()=>{input.value='';consent.checked=false;return client.disconnect();}));
    controls.append(connect,enable,disconnect,button(doc,'Refresh diagnostics',()=>run(()=>client.status())));root.append(controls,status);
    display.addEventListener('change',()=>run(()=>client.configure({enabled:state?.enabled===true,display:display.value})));
    for(const [title,url]of [['KAL website / registration','https://kalends.dev/'],['API documentation','https://kalends.dev/api-docs'],['Official forum thread','https://www.torn.com/forums.php#/p=threads&f=67&t=16597240']]){const a=element(doc,'a',title);a.href=url;a.target='_blank';a.rel='noopener noreferrer';root.append(a,doc.createTextNode(' · '));}
    root.append(element(doc,'p',attribution));
    client.status().then(show,error=>{status.textContent=error.message;});
  }
  function pagePlayer(location) {
    const url=new URL(location.href);
    const raw=url.pathname==='/profiles.php'?url.searchParams.get('XID'):null;
    try{return raw?K.playerId(raw):null;}catch{return null;}
  }
  function mountPage({document:doc=global.document,location=global.location,client,clipboard=text=>global.navigator.clipboard.writeText(text)}) {
    if(doc.getElementById('slink-kal-panel'))return;
    let id=pagePlayer(location);if(!id)return;
    const root=element(doc,'details'),summary=element(doc,'summary','SLINK · KAL equipment');root.id='slink-kal-panel';
    // Closed/manual by default, so the official display remains usable and no read occurs invisibly.
    root.style.cssText='position:fixed;right:12px;top:150px;z-index:100000;max-width:min(420px,90vw);max-height:70vh;overflow:auto;padding:10px;border:1px solid var(--slink-border,var(--s-border,#777));border-radius:8px;background:var(--slink-panel-bg,var(--s-panel,var(--default-bg-panel-color,#fff)));color:var(--slink-text,var(--s-text,var(--default-color,#222)));font:13px/1.5 sans-serif;';
    const style=element(doc,'style');style.textContent="#slink-kal-panel{--kal-bg:var(--slink-panel-bg,var(--slink-surface,var(--s-panel,#252a32)));--kal-fg:var(--slink-text,var(--s-text,#eee));--kal-border:var(--slink-border,var(--s-border,#7778));--kal-accent:var(--slink-accent,#5a9bd7);--kal-muted:var(--slink-muted,#aaa);width:min(590px,calc(100vw - 24px));box-shadow:0 8px 22px #0005}\\n#slink-kal-panel summary{font-weight:700;cursor:pointer;padding:5px;background:color-mix(in srgb,var(--kal-accent) 12%,transparent)}\\n#slink-kal-panel button{appearance:none;border:1px solid var(--kal-border);border-radius:4px;padding:4px 9px;background:color-mix(in srgb,var(--kal-accent) 12%,var(--kal-bg));color:var(--kal-fg);cursor:pointer}\\n#slink-kal-panel button:disabled{opacity:.35;cursor:default}\\n#slink-kal-panel button:focus-visible{outline:2px solid var(--kal-accent);outline-offset:2px}\\n#slink-kal-panel .slink-kal-equipment{box-sizing:border-box;display:grid;grid-template-columns:64px minmax(0,1fr);gap:8px;padding:7px 9px;border-bottom:1px solid var(--kal-border);align-items:start;min-height:52px}\\n#slink-kal-panel .slink-kal-equipment:nth-child(even){background:color-mix(in srgb,var(--kal-accent) 5%,transparent)}\\n#slink-kal-panel .slink-kal-item-plate{width:60px;height:36px;display:flex;align-items:center;justify-content:center;border:1px solid var(--kal-border);border-radius:4px;overflow:hidden}\\n#slink-kal-panel .slink-kal-item-plate img{object-fit:contain;max-width:100%;max-height:100%}\\n#slink-kal-panel .slink-kal-item-details{display:flex;flex-direction:column;gap:3px;min-width:0;overflow-wrap:anywhere}\\n#slink-kal-panel .slink-kal-item-details small{color:var(--kal-muted)}\\n#slink-kal-panel .slink-kal-bonus{color:var(--kal-accent)}\\n#slink-kal-panel .slink-kal-item-name{font-size:12px}\\n#slink-kal-panel .slink-kal-item-details span{font-size:11px}\\n#slink-kal-panel .slink-kal-item-details strong{color:var(--kal-fg)}";root.prepend(style);
    const status=element(doc,'p'),cards=element(doc,'div'),controls=element(doc,'div');status.setAttribute('role','status');root.append(summary,status,controls,cards,element(doc,'small',attribution));
    const history=(()=>{
      let snapshots=[],position=-1,player=null;
      return {
        selected:()=>snapshots[position]||null,
        text:()=>snapshots[position]?K.loadoutText(snapshots[position]):null,
        clear:()=>{snapshots=[];position=-1;player=null;},
        select:async id=>{const result=await client.load(id);player=id;snapshots=[result];position=0;return result;},
        older:async()=>{if(position<snapshots.length-1)return snapshots[++position];const cursor=snapshots[position]?.pagination?.next_cursor;if(!cursor)return null;const result=await client.load(player,cursor);snapshots.push(result);position++;return result;},
        newer:()=>position>0?Promise.resolve(snapshots[--position]):Promise.resolve(null),
        latest:()=>position>0?Promise.resolve(snapshots[position=0]):Promise.resolve(snapshots[0]||null),
        canOlder:()=>position<snapshots.length-1||!!snapshots[position]?.pagination?.next_cursor,
        canNewer:()=>position>0
      };
    })();let busy=false,viewGeneration=0;
    const latest=button(doc,'Latest',()=>load(()=>history.latest())),older=button(doc,'‹',()=>load(()=>history.older())),newer=button(doc,'›',()=>load(()=>history.newer())),copy=button(doc,'Copy',async()=>{const value=history.text();if(!value)return;try{await clipboard(value);status.textContent='Selected loadout copied.';}catch{status.textContent='Clipboard unavailable. Select the equipment text to copy it.';}});
    older.title='Older loadout';older.setAttribute('aria-label','Older');newer.title='Newer loadout';newer.setAttribute('aria-label','Newer');copy.setAttribute('aria-label','Copy selected');controls.append(copy,older,newer,latest);
    function sync(){latest.disabled=busy||!history.canNewer();older.disabled=busy||!history.canOlder();newer.disabled=busy||!history.canNewer();copy.disabled=busy||!history.selected();}
    async function load(work){if(busy)return;busy=true;const generation=++viewGeneration;cards.replaceChildren();status.textContent='Loading KAL equipment…';sync();try{const value=await work();if(generation!==viewGeneration||!value)return;status.textContent='Observed: '+K.stamp(value.observed_at);for(const item of value.equipment){
      const card=element(doc,'div');card.className='slink-kal-equipment';
      const plate=element(doc,'span');plate.className='slink-kal-item-plate';
      const raw=item.image_base||item.image_url||item.image;
      if(typeof raw==='string'&&/^https:\/\//.test(raw)){const img=element(doc,'img');img.src=item.image_base?raw+'.png':raw;img.alt=item.name||'Item';img.loading='lazy';plate.append(img);}
      else plate.append(element(doc,'span','◈'));
      const details=element(doc,'div');details.className='slink-kal-item-details';
      const name=element(doc,'strong',item.name||'Unknown equipment');name.className='slink-kal-item-name';details.append(name);
      const meta=[item.slot_name,item.rarity].filter(Boolean);if(meta.length){const line=element(doc,'small',meta.join(' · '));details.append(line);}
      const stats=item.stats&&typeof item.stats==='object'?Object.entries(item.stats):[['Damage',item.damage],['Accuracy',item.accuracy],['Armor',item.armor]].filter(([k,v])=>v!=null);
      if(stats.length)details.append(element(doc,'span',stats.map(([k,v])=>k+': '+(v??'Unknown')).join(' · ')));
      for(const bonus of item.bonuses||[]){const line=element(doc,'span',[bonus.title||bonus.name||'Bonus',bonus.description||bonus.value].filter(Boolean).join(' · '));line.className='slink-kal-bonus';details.append(line);}
      for(const mod of [...(item.mods||[]),...(item.upgrades||[])])details.append(element(doc,'small','Mod · '+(mod.description||mod.name||'Unknown')));
      if(item.ammo)details.append(element(doc,'small','Ammo · '+(item.ammo.type||item.ammo.name||'Unknown')));
      if(item.effect)details.append(element(doc,'small',String(item.effect)));
      card.append(plate,details);cards.append(card);
    }if(!value.equipment.length)cards.append(element(doc,'p','No equipment records returned. Missing slots are unknown.'));}catch(error){if(generation===viewGeneration)status.textContent=error.message;}finally{if(generation===viewGeneration){busy=false;sync();}}}
    async function refresh(){const state=await client.status();root.hidden=!pagePlayer(location)||!state.enabled||state.display==='official';if(root.hidden){viewGeneration++;busy=false;history.clear();cards.replaceChildren();root.open=false;}sync();}
    root.addEventListener('toggle',()=>{if(root.open&&!root.hidden&&!history.selected())void load(()=>history.select(id));});
    doc.addEventListener('kal-settings-changed',()=>void refresh().catch(()=>{}));
    global.addEventListener?.('popstate',()=>{const next=pagePlayer(location);if(next===id)return;id=next;viewGeneration++;busy=false;history.clear();cards.replaceChildren();root.open=false;root.hidden=true;sync();void refresh().catch(()=>{});});
    (doc.body||doc.documentElement).append(root);sync();void refresh().catch(error=>{status.textContent=error.message;root.hidden=true;});
    return {root,refresh};
  }
  global.SLINK_KAL_UI=Object.freeze({mountSettings,mountPage,pagePlayer});
})(globalThis);
