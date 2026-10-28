(function installFactionOfficerService(global) {
  'use strict';
  const SLINK = global.SLINK_EXTENSION;
  const CORE = SLINK.core.factionOfficers;
  const BASE_URL = 'https://slinkcontributionworker.richard-johnson554.workers.dev';
  const REFRESH_MS = 5 * 60_000;
  const DAY_MS = 86_400_000;
  const KEYS = Object.freeze({
    runtime:'faction.onboarding.runtime.v1',
    dismissed:'faction.onboarding.dismissed.v1',
    settings:'faction.officer.settings.v1',
    stockRuntime:'faction.officer.stock.runtime.v1'
  });
  let refreshing = null;
  let stockRefreshing = null;
  let settingsQueue = Promise.resolve();
  let preferenceQueue = Promise.resolve();
  function mutateStockSettings(updater){
    const operation=settingsQueue.catch(()=>{}).then(async()=>{
      const previous=await SLINK.core.storage.get(KEYS.settings,{});
      const next=updater(previous||{});await SLINK.core.storage.set(KEYS.settings,next);return next;
    });settingsQueue=operation;return operation;
  }

  async function accessKey() {
    const [access,leveling,war] = await Promise.all([
      SLINK.services.permissionAccess.settings(),
      SLINK.core.storage.get('leveling.settings.v1',{}),
      SLINK.core.storage.get('war.settings.v1',{})
    ]);
    return String(access?.tornKey || leveling?.tornKey || war?.tornKey || '').trim();
  }
  async function permissions() {
    return SLINK.core.storage.get('permissions.snapshot',{scopes:[]});
  }
  async function has(scope) {
    return SLINK.core.permissions.hasScope(await permissions(),scope);
  }
  async function session(requiredScope = CORE.OFFICER_SCOPE) {
    return SLINK.services.permissionAccess.ensureSession(false,requiredScope);
  }
  async function workerRequest(path,options = {},requiredScope = CORE.OFFICER_SCOPE) {
    const current = await session(requiredScope);
    return SLINK.core.http.requestJson('contributionWorker',BASE_URL+path,{
      ...options,
      headers:{Authorization:`Bearer ${current.token}`,...(options.headers||{})},
      body:options.body && typeof options.body !== 'string' ? JSON.stringify(options.body) : options.body
    });
  }
  async function tornJson(path,key) {
    await SLINK.core.tornApiLimiter.reserve({wait:true});
    const response = await SLINK.core.http.requestJson('tornApi',`https://api.torn.com${path}`,{
      headers:{Authorization:`ApiKey ${key}`},cache:'no-store'
    });
    if (response?.error) throw new Error(response.error.message || response.error.error || 'Torn API request failed.');
    return response || {};
  }
  async function tornMembers() {
    const key=await accessKey();
    if(!key) throw new Error('Save your Torn API key before checking faction members.');
    const response=await tornJson('/v2/faction/members?comment=SLINK%20faction%20officers',key);
    const source=response?.members??response?.faction?.members??[];
    const rows=Array.isArray(source)?source:Object.entries(source||{}).map(([id,member])=>({id,...(member||{})}));
    const members=rows.map(row=>{
      const id=Number(row?.id??row?.user_id??row?.player_id);
      if(!Number.isInteger(id)||id<=0)return null;
      const position=row?.position;
      return {id,name:String(row?.name||`Player ${id}`),position:String(position?.name??row?.position_name??position??row?.rank??'Member').trim()||'Member',level:Math.max(0,Math.trunc(Number(row?.level)||0))};
    }).filter(Boolean);
    if(!members.length)throw new Error('Torn returned no faction members. A faction-capable API key may be required.');
    return members;
  }
  async function runtime(){return {fetchedAt:0,nextRefreshAt:0,alerts:[],lastError:'',...(await SLINK.core.storage.get(KEYS.runtime,{}))};}
  async function saveRuntime(changes){const next={...(await runtime()),...changes};await SLINK.core.storage.set(KEYS.runtime,next);return next;}
  async function stockSettings(){
    const value=await SLINK.core.storage.get(KEYS.settings,{});
    return normalizeStockSettings(value);
  }
  function normalizeStockSettings(value={}){
    return {
      armory:{checksPerDay:Math.min(24,Math.max(0,Math.trunc(Number.isFinite(Number(value?.armory?.checksPerDay))?Number(value.armory.checksPerDay):4))),soundEnabled:value?.armory?.soundEnabled!==false,thresholds:CORE.normalizeThresholds(value?.armory?.thresholds,CORE.ARMORY_ITEMS)},
      oc:{checksPerDay:Math.min(24,Math.max(0,Math.trunc(Number(value?.oc?.checksPerDay)||0))),soundEnabled:value?.oc?.soundEnabled!==false,thresholds:CORE.normalizeThresholds(value?.oc?.thresholds,CORE.OC_ITEMS)},
      snoozedUntil:value?.snoozedUntil&&typeof value.snoozedUntil==='object'?value.snoozedUntil:{}
    };
  }
  function saveStockSettings(input={}){
    const kinds=['armory','oc'].filter(kind=>Object.hasOwn(input,kind));
    const patch=Object.fromEntries(kinds.map(kind=>[kind,{...input[kind],...(input[kind]?.thresholds?{thresholds:{...input[kind].thresholds}}:{})}]));
    const authorization=Promise.resolve().then(()=>Promise.all(kinds.map(kind=>session(kind==='armory'?CORE.ARMORY_SCOPE:CORE.OC_SCOPE))));void authorization.catch(()=>{});
    const operation=preferenceQueue.catch(()=>{}).then(()=>authorization).then(async()=>{
      const next=await mutateStockSettings(previous=>{
        const merged={...previous};
        for(const kind of ['armory','oc'])merged[kind]={...previous[kind],...patch[kind],thresholds:{...previous[kind]?.thresholds,...patch[kind]?.thresholds}};
        const normalized=normalizeStockSettings(merged);
        for(const kind of ['armory','oc'])merged[kind]={...merged[kind],...normalized[kind],thresholds:{...merged[kind].thresholds,...normalized[kind].thresholds}};
        return merged;
      });return {settings:normalizeStockSettings(next)};
    });preferenceQueue=operation;return operation;
  }
  async function stockRuntime(){return {inventory:[],points:0,armoryShortages:[],ocShortages:[],missingCrimeItems:[],lastArmoryCheckAt:0,lastOcCheckAt:0,armoryError:'',ocError:'',itemCatalog:[],itemCatalogAt:0,...(await SLINK.core.storage.get(KEYS.stockRuntime,{}))};}
  async function saveStockRuntime(changes){const next={...(await stockRuntime()),...changes};await SLINK.core.storage.set(KEYS.stockRuntime,next);return next;}
  function due(lastAt,checksPerDay){
    const count=Math.max(0,Number(checksPerDay)||0);
    return count>0 && Date.now()-Number(lastAt||0)>=DAY_MS/count;
  }
  async function fetchInventory(key){
    const inventory=[];
    for(const category of CORE.INVENTORY_CATEGORIES){
      for(let offset=0;offset<1000;offset+=100){
        const body=await tornJson(`/v2/faction/inventory?cat=${encodeURIComponent(category)}&limit=100&offset=${offset}&comment=SLINK%20armory%20thresholds`,key);
        const rows=Array.isArray(body?.inventory)?body.inventory:[];
        inventory.push(...rows);
        if(rows.length<100)break;
      }
    }
    const balance=await tornJson('/v2/faction/balance?comment=SLINK%20armory%20points',key);
    return {inventory,points:Math.max(0,Number(balance?.balance?.faction?.points??balance?.faction?.points)||0)};
  }
  async function fetchCurrentCrimes(key){
    const crimes=[];
    for(let offset=0;offset<500;offset+=100){
      const body=await tornJson(`/v2/faction/crimes?cat=current&limit=100&offset=${offset}&comment=SLINK%20OC%20item%20check`,key);
      const rows=Array.isArray(body?.crimes)?body.crimes:[];
      crimes.push(...rows);
      if(rows.length<100)break;
    }
    return {crimes};
  }
  async function refreshStock(kind='all',force=false){
    if(stockRefreshing)return stockRefreshing;
    stockRefreshing=(async()=>{
      const [config,current,armoryAllowed,ocAllowed]=await Promise.all([stockSettings(),stockRuntime(),has(CORE.ARMORY_SCOPE),has(CORE.OC_SCOPE)]);
      const runArmory=armoryAllowed&&(kind==='all'||kind==='armory')&&(force||due(current.lastArmoryCheckAt,config.armory.checksPerDay));
      const runOc=ocAllowed&&(kind==='all'||kind==='oc')&&(force||due(current.lastOcCheckAt,config.oc.checksPerDay));
      if(!runArmory&&!runOc)return stockStatus(false);
      const key=await accessKey();
      if(!key)throw new Error('Save a limited-access Torn API key before running officer checks.');
      let next={...current};
      if(runArmory||runOc){
        try{
          const inventory=await fetchInventory(key);
          next.inventory=inventory.inventory;
          next.points=inventory.points;
          if(runArmory){
            next.armoryShortages=CORE.shortages(CORE.ARMORY_ITEMS,config.armory.thresholds,next.inventory,next.points);
            next.lastArmoryCheckAt=Date.now();next.armoryError='';
          }
          if(runOc){
            next.ocShortages=CORE.shortages(CORE.OC_ITEMS,config.oc.thresholds,next.inventory,next.points);
          }
        }catch(error){
          const message=SLINK.core.format.errorMessage(error);
          if(runArmory)next.armoryError=message;
          if(runOc)next.ocError=message;
          await saveStockRuntime(next);throw error;
        }
      }
      if(runOc){
        try{
          const [crimePayload,memberPayload]=await Promise.all([
            fetchCurrentCrimes(key),
            tornJson('/v2/faction/members?comment=SLINK%20OC%20member%20names',key)
          ]);
          let catalogPayload={items:next.itemCatalog};
          if(!Array.isArray(next.itemCatalog)||!next.itemCatalog.length||Date.now()-Number(next.itemCatalogAt||0)>DAY_MS){
            catalogPayload=await tornJson('/v2/torn/items?comment=SLINK%20OC%20item%20names',key);
            next.itemCatalog=Array.isArray(catalogPayload?.items)?catalogPayload.items:Object.values(catalogPayload?.items||{});
            next.itemCatalogAt=Date.now();
          }
          next.missingCrimeItems=CORE.missingCrimeItems(crimePayload,CORE.itemCatalog(catalogPayload),CORE.memberCatalog(memberPayload));
          next.lastOcCheckAt=Date.now();next.ocError='';
        }catch(error){next.ocError=SLINK.core.format.errorMessage(error);await saveStockRuntime(next);throw error;}
      }
      await saveStockRuntime(next);
      return stockStatus(false);
    })();
    try{return await stockRefreshing;}finally{stockRefreshing=null;}
  }
  async function stockStatus(refreshIfDue=true){
    const [config,current,armoryAllowed,ocAllowed,adminAllowed]=await Promise.all([stockSettings(),stockRuntime(),has(CORE.ARMORY_SCOPE),has(CORE.OC_SCOPE),has(CORE.ADMIN_SCOPE)]);
    if(refreshIfDue&&((armoryAllowed&&due(current.lastArmoryCheckAt,config.armory.checksPerDay))||(ocAllowed&&due(current.lastOcCheckAt,config.oc.checksPerDay)))){
      try{return await refreshStock('all',false);}catch{}
    }
    if(current.lastArmoryCheckAt)current.armoryShortages=CORE.shortages(CORE.ARMORY_ITEMS,config.armory.thresholds,current.inventory,current.points);
    if(current.lastOcCheckAt)current.ocShortages=CORE.shortages(CORE.OC_ITEMS,config.oc.thresholds,current.inventory,current.points);
    return {settings:config,runtime:current,access:{armory:armoryAllowed,oc:ocAllowed,admin:adminAllowed}};
  }
  async function refresh(force=false){
    if(refreshing)return refreshing;
    refreshing=(async()=>{
      const previous=await runtime();
      if(!force&&Number(previous.nextRefreshAt)>Date.now())return previous;
      try{
        const members=await tornMembers();
        const response=await workerRequest('/api/faction/onboarding/sync',{method:'POST',headers:{'Content-Type':'application/json'},body:{members}});
        return saveRuntime({fetchedAt:Date.now(),nextRefreshAt:Date.now()+REFRESH_MS,alerts:Array.isArray(response?.alerts)?response.alerts:[],viewerIsAdmin:response?.viewer_is_admin===true,factionId:Number(response?.faction_id)||0,initialized:response?.initialized===true,rosterCount:Number(response?.roster_count)||members.length,lastError:''});
      }catch(error){await saveRuntime({nextRefreshAt:Date.now()+60_000,lastError:SLINK.core.format.errorMessage(error)});throw error;}
    })();
    try{return await refreshing;}finally{refreshing=null;}
  }
  async function status(refreshIfDue=true){
    let current=await runtime();
    if(refreshIfDue&&await has(CORE.OFFICER_SCOPE)&&Number(current.nextRefreshAt)<=Date.now()){try{current=await refresh(false);}catch{}}
    return current;
  }
  async function dismissed(){const value=await SLINK.core.storage.get(KEYS.dismissed,{});return value&&typeof value==='object'?value:{};}
  function alertId(row){return `factionOnboarding:${Number(row.user_id)}:${Number(row.joined_at)||0}`;}
  async function activeAlerts(refreshIfDue=true){
    const [allowed,adminAllowed,current,hidden,adhdSettings,stock]=await Promise.all([
      has(CORE.OFFICER_SCOPE),has(CORE.ADMIN_SCOPE),status(refreshIfDue),dismissed(),
      SLINK.core.storage.get('adhd.settings.v1',{}),stockStatus(refreshIfDue)
    ]);
    const settings=SLINK.core.adhd.normalizeSettings(adhdSettings);const now=Date.now();const alerts=[];
    if(allowed&&settings.enabled.factionOnboarding!==false){
      alerts.push(...(Array.isArray(current.alerts)?current.alerts:[])
        .filter(row=>Number(hidden[row.user_id])!==Number(row.joined_at))
        .filter(row=>adminAllowed||!Number(row.officer_verified_at))
        .map(row=>{
        const id=alertId(row);const level=Math.max(0,Number(row.level)||0);const position=String(row.position||'Member');
        const checklist=[...(level>0&&level<15?['proficiency weapon']:[]),'armor','20 Pepper Spray','20 Morphine',...(position.toLowerCase().includes('recruit')?['4 Xanax only if stacking and still recruit']:[])];
        return {id,settingId:'factionOnboarding',kind:'faction-onboarding',memberId:Number(row.user_id),joinedAt:Number(row.joined_at)||0,active:Number(settings.snoozedUntil[id]||0)<=now,title:`New faction member: ${row.user_name} [${row.user_id}]`,detail:`${position}${level?` · Level ${level}`:''}${Number(row.officer_verified_at)?' · Officer verified; awaiting admin confirmation':''} · Check: ${checklist.join('; ')}.`,tone:'urgent',links:[['Profile',`https://www.torn.com/profiles.php?XID=${row.user_id}`]],viewerIsAdmin:adminAllowed,officerVerifiedAt:Number(row.officer_verified_at)||0,soundEnabled:settings.soundEnabled.factionOnboarding===true};
      }).filter(alert=>alert.active));
    }
    const sr=stock.runtime,ss=stock.settings;
    if(stock.access.armory&&sr.armoryShortages?.length&&Number(ss.snoozedUntil.factionArmory||0)<=now){
      alerts.push({id:'factionArmory',kind:'faction-armory',title:'Faction armory restock needed',detail:`${sr.armoryShortages.length} configured ${sr.armoryShortages.length===1?'item is':'items are'} below target.`,tone:'urgent',links:[['Faction Armory',CORE.ARMORY_URL]],shareText:CORE.restockMessage('Restock Needed:',sr.armoryShortages),soundEnabled:ss.armory.soundEnabled});
    }
    if(stock.access.oc&&sr.ocShortages?.length&&Number(ss.snoozedUntil.factionOcStock||0)<=now){
      alerts.push({id:'factionOcStock',kind:'faction-oc-stock',title:'Organized crime supplies need restocking',detail:`${sr.ocShortages.length} configured OC ${sr.ocShortages.length===1?'item is':'items are'} below target.`,tone:'urgent',links:[['Faction Armory',CORE.ARMORY_URL]],shareText:CORE.restockMessage('OC Restock Needed:',sr.ocShortages),soundEnabled:ss.oc.soundEnabled});
    }
    if(stock.access.oc&&sr.missingCrimeItems?.length&&Number(ss.snoozedUntil.factionOcMissing||0)<=now){
      const message=CORE.missingCrimeMessage(sr.missingCrimeItems);
      alerts.push({id:'factionOcMissing',kind:'faction-oc-missing',title:'Active organized crimes are missing items',detail:`${sr.missingCrimeItems.length} assigned ${sr.missingCrimeItems.length===1?'slot is':'slots are'} missing a required item.`,tone:'urgent',links:[['Faction Armory',CORE.ARMORY_URL],['Organized Crimes',CORE.CRIMES_URL]],shareText:message,soundEnabled:ss.oc.soundEnabled});
    }
    return alerts.filter(alert=>alert.active!==false);
  }
  async function snooze(input={}){
    const id=String(input.id||'');if(!['factionArmory','factionOcStock','factionOcMissing'].includes(id))throw new Error('Unknown officer alert.');
    const until=Date.now()+Math.min(DAY_MS,Math.max(60_000,Number(input.durationMs)||60*60_000));
    await mutateStockSettings(previous=>({...previous,snoozedUntil:{...previous.snoozedUntil,[id]:until}}));return {ok:true};
  }
  async function verify(input={}){
    const memberId=Number(input.memberId);if(!Number.isInteger(memberId)||memberId<=0)throw new Error('A valid faction member is required.');
    const response=await workerRequest(`/api/faction/onboarding/${memberId}/verify`,{method:'POST',headers:{'Content-Type':'application/json'},body:{}});
    await saveRuntime({fetchedAt:Date.now(),nextRefreshAt:Date.now()+REFRESH_MS,alerts:Array.isArray(response?.alerts)?response.alerts:[],viewerIsAdmin:response?.viewer_is_admin===true,factionId:Number(response?.faction_id)||0,lastError:''});return response;
  }
  async function dismiss(input={}){
    await session(CORE.OFFICER_SCOPE);
    const memberId=Number(input.memberId),joinedAt=Number(input.joinedAt)||0;if(!Number.isInteger(memberId)||memberId<=0)throw new Error('A valid faction member is required.');
    const value=await dismissed();value[memberId]=joinedAt;await SLINK.core.storage.set(KEYS.dismissed,value);return {ok:true,memberId,joinedAt};
  }
  async function officerAccessStatus(){
    const current=await session(CORE.ADMIN_SCOPE);const members=await tornMembers();const factionId=Number(current.factionId)||0;
    if(!factionId)throw new Error('Your authenticated Torn account is not in a faction.');
    const response=await workerRequest(`/api/admin/factions/${factionId}/officer-access`,{},CORE.ADMIN_SCOPE);
    const assignments=response?.assignments||{};
    const scopes=[CORE.OFFICER_SCOPE,CORE.ARMORY_SCOPE,CORE.OC_SCOPE];
    const roles=[...new Set(members.map(member=>member.position).filter(Boolean))].sort((a,b)=>a.localeCompare(b)).map(name=>({name,memberCount:members.filter(member=>member.position===name).length,scopes:Object.fromEntries(scopes.map(scope=>[scope,(assignments[scope]?.roles||[]).includes(name)]))}));
    const users=members.slice().sort((a,b)=>a.name.localeCompare(b.name)).map(member=>({...member,scopes:Object.fromEntries(scopes.map(scope=>[scope,(assignments[scope]?.users||[]).some(user=>Number(user.id)===member.id)]))}));
    return {factionId,roles,users,memberCount:members.length,scopes};
  }
  async function saveOfficerAccess(input={}){
    const assignments=structuredClone(input.assignments||{});
    const current=await session(CORE.ADMIN_SCOPE),factionId=Number(current.factionId)||0;if(!factionId)throw new Error('Your authenticated Torn account is not in a faction.');
    await workerRequest(`/api/admin/factions/${factionId}/officer-access`,{method:'POST',headers:{'Content-Type':'application/json'},body:{assignments}},CORE.ADMIN_SCOPE);
    await SLINK.services.permissionAccess.ensureSession(true,CORE.ADMIN_SCOPE);return officerAccessStatus();
  }
  async function publicStatus(refreshIfDue=true){
    const [onboarding,stock]=await Promise.all([status(refreshIfDue),stockStatus(refreshIfDue)]);
    return {...stock,onboarding,definitions:{armory:CORE.ARMORY_ITEMS,oc:CORE.OC_ITEMS}};
  }
  const routes=Object.freeze({
    'faction.onboarding.status':payload=>status(payload?.refreshIfDue!==false),
    'faction.onboarding.refresh':()=>refresh(true),
    'faction.onboarding.verify':verify,
    'faction.onboarding.dismiss':dismiss,
    'faction.officer.status':payload=>publicStatus(payload?.refreshIfDue!==false),
    'faction.officer.settings.save':saveStockSettings,
    'faction.officer.refresh':payload=>refreshStock(String(payload?.kind||'all'),true),
    'faction.officer.alert.snooze':snooze,
    'faction.officer-access.status':officerAccessStatus,
    'faction.officer-access.save':saveOfficerAccess,
    'faction.officer-roles.status':officerAccessStatus,
    'faction.officer-roles.save':input=>saveOfficerAccess({assignments:{[CORE.OFFICER_SCOPE]:{roles:input.roles||[],users:[]}}})
  });
  SLINK.define('services','factionOfficer',Object.freeze({OFFICER_SCOPE:CORE.OFFICER_SCOPE,activeAlerts,refresh,routes,status:publicStatus}));
})(globalThis);
