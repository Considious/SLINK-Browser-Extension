(function installCompanyService(global) {
  'use strict';

  const SLINK = global.SLINK_EXTENSION;
  const COMPANY = SLINK.core.company;
  const KEYS = Object.freeze({
    settings:'company.settings.v1',
    runtime:'company.runtime.v1'
  });
  let refreshing = null;
  let settingsQueue = Promise.resolve();

  async function settings() {
    return COMPANY.normalizeSettings(await SLINK.core.storage.get(KEYS.settings, {}));
  }

  async function saveSettings(value = {}) {
    const operation = settingsQueue.catch(() => {}).then(async () => {
      const previous = await SLINK.core.storage.get(KEYS.settings, {});
      const next = { ...previous, ...COMPANY.normalizeSettings({ ...previous, ...(value || {}) }) };
      await SLINK.core.storage.set(KEYS.settings, next);
      return { settings:COMPANY.normalizeSettings(next) };
    });
    settingsQueue = operation;
    return operation;
  }

  async function runtime() {
    return {
      fetchedAt:0,
      snapshot:null,
      lastError:'',
      ...(await SLINK.core.storage.get(KEYS.runtime, {}))
    };
  }

  async function tornKey() {
    const [access, leveling, war] = await Promise.all([
      SLINK.services.permissionAccess.settings(),
      SLINK.core.storage.get('leveling.settings.v1', {}),
      SLINK.core.storage.get('war.settings.v1', {})
    ]);
    return String(access?.tornKey || leveling?.tornKey || war?.tornKey || '').trim();
  }

  const monitoringEnabled=async()=>await SLINK.core.storage.get('ui.monitoring.company.enabled',true)!==false;
  async function tornJson(url, key) {
    if(!await monitoringEnabled())throw Error('This module is paused in Access.');
    await SLINK.core.tornApiLimiter.reserve({ wait:true, script:'SLINK Company', endpoint:url });
    if(!await monitoringEnabled())throw Error('This module is paused in Access.');
    const response = await SLINK.core.http.requestJson('tornApi', url, {
      headers:{ Authorization:`ApiKey ${key}` },
      cache:'no-store'
    });
    if (response?.error) {
      const error = new Error(response.error.message || response.error.error || 'Torn API request failed.');
      error.code = 'SLINK_COMPANY_TORN_ERROR';
      throw error;
    }
    return response;
  }

  async function refresh(force = false) {
    if(!await monitoringEnabled())return publicStatus(false);
    if (refreshing) return refreshing;
    refreshing = (async () => {
      const permissionSession = await SLINK.services.permissionAccess.ensureSession(false, COMPANY.SCOPE);
      const currentSettings = await settings();
      const cached = await runtime();
      const ttl = Math.max(5, Number(currentSettings.refreshMinutes) || 15) * 60_000;
      if (!force && cached.snapshot && Date.now() - Number(cached.fetchedAt || 0) < ttl) return publicStatus(false);
      const key = await tornKey();
      if (!key) throw new Error('Save your Torn API key under API and feature access first.');
      try {
        const [job, jobpoints, profile, employees] = await Promise.all([
          tornJson('https://api.torn.com/v2/user/job?comment=SLINK%20company%20assistant', key),
          tornJson('https://api.torn.com/v2/user/jobpoints?comment=SLINK%20company%20assistant', key),
          tornJson('https://api.torn.com/v2/company/profile?comment=SLINK%20company%20assistant', key),
          tornJson('https://api.torn.com/v2/company/employees?comment=SLINK%20company%20assistant', key)
        ]);
        const snapshot = COMPANY.normalizeSnapshot(
          { ...job, ...jobpoints },
          { ...profile, ...employees },
          permissionSession?.userId,
          Date.now()
        );
        await SLINK.core.storage.set(KEYS.runtime, { fetchedAt:Date.now(), snapshot, lastError:'' });
      } catch (error) {
        await SLINK.core.storage.set(KEYS.runtime, { ...cached, lastError:SLINK.core.format.errorMessage(error) });
        throw error;
      }
      return publicStatus(false);
    })();
    try { return await refreshing; }
    finally { refreshing = null; }
  }

  async function publicStatus(refreshIfDue = true) {
    const [currentSettings, currentRuntime, permissions] = await Promise.all([
      settings(),
      runtime(),
      SLINK.core.storage.get('permissions.snapshot', null)
    ]);
    const permitted = SLINK.core.permissions.hasScope(permissions || {}, COMPANY.SCOPE);
    const ttl = Math.max(5, Number(currentSettings.refreshMinutes) || 15) * 60_000;
    if (refreshIfDue && await monitoringEnabled() && permitted && (!currentRuntime.snapshot || Date.now() - Number(currentRuntime.fetchedAt || 0) >= ttl)) {
      try { return await refresh(false); } catch {}
    }
    return {
      permitted,
      requiredScope:COMPANY.SCOPE,
      settings:currentSettings,
      snapshot:currentRuntime.snapshot,
      fetchedAt:Number(currentRuntime.fetchedAt) || 0,
      lastError:String(currentRuntime.lastError || ''),
      activeAlerts:permitted && await monitoringEnabled() ? COMPANY.buildAlerts(currentRuntime.snapshot, currentSettings) : []
    };
  }

  async function activeAlerts() {
    if(!await monitoringEnabled())return [];
    try {
      const result = await publicStatus(true);
      return result.activeAlerts || [];
    } catch {
      return [];
    }
  }

  let sidebarCheck=null;
  async function sidebarCompany(){
    if(sidebarCheck)return sidebarCheck;
    sidebarCheck=(async()=>{
      if(!await monitoringEnabled())return null;
      const session=await SLINK.services.permissionAccess.ensureSession(false,COMPANY.SCOPE);
      const owner=String(session?.userId||'');if(!owner)return null;
      const keyName='inline-status.companyDaily.v1',cached=await SLINK.core.storage.get(keyName,null),now=new Date(),date=now.toISOString().slice(0,10);
      if(now.getUTCHours()!==18||now.getUTCMinutes()!==15||cached?.owner===owner&&cached.date===date)return cached?.owner===owner?cached:null;
      const record={owner,date,at:Date.now(),penalty:cached?.owner===owner?cached.penalty:null};
      await SLINK.core.storage.set(keyName,record);
      const key=await tornKey();if(!key)return record;
      const result=await tornJson('https://api.torn.com/v2/company/employees?comment=SLINK%20Company%20sidebar',key);
      const rows=Array.isArray(result.employees)?result.employees:Object.values(result.employees||{});
      const value=rows.find(e=>Number(e.id??e.user_id)===Number(owner))?.effectiveness?.addiction;
      record.penalty=typeof value==='number'&&Number.isFinite(value)?Math.min(0,value):null;
      await SLINK.core.storage.set(keyName,record);return record;
    })();
    try{return await sidebarCheck;}finally{sidebarCheck=null;}
  }

  const routes = Object.freeze({
    'inline-status.company':sidebarCompany,
    'company.status':payload => publicStatus(payload?.refreshIfDue !== false),
    'company.refresh':() => refresh(true),
    'company.settings.save':payload => saveSettings(payload?.settings || payload)
  });

  SLINK.define('services', 'company', Object.freeze({
    activeAlerts,
    publicStatus,
    refresh,
    routes,
    saveSettings
  }));
})(globalThis);
