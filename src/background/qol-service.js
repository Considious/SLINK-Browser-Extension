(function(global){
  'use strict';const S=global.SLINK_EXTENSION,Q=global.SLINK_QOL;
  let queue=Promise.resolve(),infoTask=null,profileTask=null,releaseTask=null,weaponCatalogue=null;
  const KEY='qol.page-tools.v1',CACHE='qol.page-tools.info.v1',UPDATES='qol.release.v1';
  async function access(){const session=await S.services.permissionAccess.ensureSession(false);if(!S.core.permissions.hasScope(session,'slink.adhd.alerts'))throw Error('Page tools require your SLINK Efficiency permission.');return session;}
  async function owner(){const s=await access();const id=String(s.userId??s.user_id??'');if(!/^[1-9]\d*$/.test(id))throw Error('Verify your SLINK identity before using page tools.');return id;}
  async function cacheKey(){return CACHE+':'+await owner();}
  async function api(path,scope){if(scope)await S.services.permissionAccess.ensureSession(false,scope);else await access();const settings=await S.services.permissionAccess.settings();await S.core.tornApiLimiter.reserve({wait:true,priority:'high',script:'SLINK page tools',endpoint:path});const result=await S.core.http.requestJson('tornApi','https://api.torn.com'+path,{headers:{Authorization:'ApiKey '+settings.tornKey},cache:'no-store'});if(result?.error)throw Error(result.error.message||result.error.error||'Torn did not return the requested information.');return result;}
  async function profile(force=false){
    const key=await cacheKey(),cache=await S.core.storage.get(key,{});if(!force&&cache.context&&Date.now()-cache.profileAt<30000)return cache.context;
    if(profileTask)return profileTask;
    profileTask=(async()=>{const body=await api('/v2/user?selections=bars,cooldowns,profile');const context={life:body.bars?.life||body.life,status:body.profile?.status||body.status,cooldowns:body.cooldowns};const current=await S.core.storage.get(key,{});await S.core.storage.set(key,{...current,context,profileAt:Date.now()});return context;})().finally(()=>profileTask=null);return profileTask;
  }
  async function info(force=false){
    await access();const key=await cacheKey(),cached=await S.core.storage.get(key,{});
    if(!force&&cached.catalog&&cached.perks&&Date.now()-cached.catalogAt<86400000&&Date.now()-cached.perksAt<15*60000)return cached;
    if(infoTask)return infoTask;
    infoTask=(async()=>{
      const catalog=(!force&&cached.catalog&&Date.now()-cached.catalogAt<86400000)?cached.catalog:{items:Q.catalog(await api('/v2/torn/items?cat=All&sort=ASC')).map(x=>({...x,effect:/medical|alcohol|candy|drug|energy|booster|supply/i.test(x.type)?x.effect:''}))};
      const perks=await api('/v2/user/perks');const context=await profile(false);const previous=await S.core.storage.get(key,{});const result={...previous,catalog,perks,context,catalogAt:catalog===cached.catalog?cached.catalogAt:Date.now(),perksAt:Date.now(),profileAt:Date.now()};await S.core.storage.set(key,result);return result;
    })().finally(()=>infoTask=null);return infoTask;
  }
  async function updates(){
    const cached=await S.core.storage.get(UPDATES,{});if(cached.at&&Date.now()-cached.at<(cached.data?.error?300000:6*3600000))return cached.data;
    if(releaseTask)return releaseTask;
    releaseTask=(async()=>{let data;try{data=await S.core.http.requestJson('contributionWorker','https://slinkcontributionworker.richard-johnson554.workers.dev/api/releases',{cache:'no-store'});if(data?.schema!==1)throw Error('Update service unavailable.');}catch{data={schema:1,error:'Update information is temporarily unavailable.'};}await S.core.storage.set(UPDATES,{at:Date.now(),data});return data;})().finally(()=>releaseTask=null);return releaseTask;
  }
  S.define('services','pageTools',{routes:{
    'qol.leaseCompare':(input,sender)=>{
      const page=new URL(sender?.tab?.url||'https://invalid.invalid');
      if(page.origin!=='https://www.torn.com'||page.pathname!=='/properties.php')throw Error('Open Torn Properties to compare leases.');
      const type=input?.type;
      if(!Number.isSafeInteger(type)||type<0)throw Error('Choose a property type.');
      return api(type?'/v2/market/'+type+'/rentals?limit=50':'/v2/torn/properties','slink.qol.money-property');
    },
    'qol.weaponExperience':async()=>{
      const id=await owner(),body=await api('/v2/user/weaponexp');
      if(await owner()!==id)throw Error('The signed-in account changed.');
      if(!Array.isArray(body?.weaponexp))throw Error('Torn did not return weapon experience.');
      return Object.fromEntries(body.weaponexp.filter(r=>Number.isSafeInteger(r?.id)&&r.id>0&&Number.isInteger(r.exp)&&r.exp>=0&&r.exp<=100).map(r=>[r.id,r.exp]));
    },
    'qol.weaponMerits':async()=>{
      const id=await owner(),model=global.SLINK_WEAPON_MERITS;
      const cached=await S.core.storage.get('qol.weapon-classes.v1',{});
      const classes=cached.at>Date.now()-86400000&&cached.classes?Promise.resolve(cached.classes):(weaponCatalogue??=(async()=>{
        const data=model.catalogue(await api('/v2/torn/items?cat=Weapon'));
        if(!Object.keys(data).length)throw Error('Torn did not return weapon classes.');
        await S.core.storage.set('qol.weapon-classes.v1',{classes:data,at:Date.now()});return data;
      })().finally(()=>{weaponCatalogue=null;}));
      const [levels,catalogue]=await Promise.all([api('/v2/user/perks').then(model.perks),classes]);
      if(await owner()!==id)throw Error('The signed-in account changed.');
      return {levels,classes:catalogue};
    },
    'qol.get':async()=>({allowed:true,settings:Q.normalize(await S.core.storage.get(KEY+':'+await owner(),{}))}),
    'qol.save':input=>{const task=queue.then(async()=>{const key=KEY+':'+await owner(),value=Q.normalize(input);await S.core.storage.set(key,value);return value;});queue=task.catch(()=>{});return task;},
    'qol.cached':async()=>S.core.storage.get(await cacheKey(),{}),'qol.info':input=>info(input?.force===true),'qol.profile':input=>profile(input?.force===true),'qol.updates':updates
  }});
})(globalThis);
