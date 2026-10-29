(function installThemeService(global) {
  'use strict';

  const SLINK = global.SLINK_EXTENSION;
  const MAX_AGE_MS = 15 * 60 * 1000;
  let loading = null;
  let tornSettingsQueue=Promise.resolve();
  const TORN_SETTINGS_KEY='ui.tornTheme.v1';
  function patchTornSettings(input={}){
    const captured={...input};
    const task=tornSettingsQueue.catch(()=>{}).then(async()=>{
      const previous=await SLINK.core.storage.get(TORN_SETTINGS_KEY,{}),next={...previous};
      for(const [name,value]of Object.entries(captured)){
        if(['enabled','background','frames','ornaments','chat'].includes(name)){
          if(typeof value!=='boolean')throw Error('Use an on/off value for Torn theme options.');next[name]=value;
        }else if(name==='opacity'){
          const number=Number(value);if(!Number.isFinite(number))throw Error('Use an opacity from 0 to 100.');next[name]=Math.max(0,Math.min(100,Math.round(number)));
        }else throw Error('Unknown Torn theme option.');
      }
      await SLINK.core.storage.set(TORN_SETTINGS_KEY,next);return next;
    });tornSettingsQueue=task;return task;
  }

  function catalogHasCurrentAssets(catalog) {
    return Array.isArray(catalog?.themes) && catalog.themes.every(theme => {
      const assets = theme?.assets;
      return assets && typeof assets === 'object' &&
        Object.hasOwn(assets, 'brandIcon') &&
        Object.hasOwn(assets, 'chatIcon');
    });
  }

  async function cachedRecord() {
    const record = await SLINK.core.storage.get(SLINK.core.themes.CATALOG_STORAGE_KEY, null);
    if (!record?.catalog) return null;
    try {
      SLINK.core.themes.installCatalog(record.catalog);
      return { ...record, needsAssetRefresh:!catalogHasCurrentAssets(record.catalog) };
    } catch {
      await SLINK.core.storage.remove(SLINK.core.themes.CATALOG_STORAGE_KEY);
      return null;
    }
  }

  async function load(force = false) {
    if (loading) return loading;
    loading = (async () => {
      const cached = await cachedRecord();
      const refreshAssets = cached?.needsAssetRefresh === true;
      if (!force && !refreshAssets && cached && Date.now() - Number(cached.fetchedAt) < MAX_AGE_MS) {
        return { catalog:SLINK.core.themes.catalog(), source:String(cached.source || 'extension-cache'), fetchedAt:Number(cached.fetchedAt), error:'' };
      }
      try {
        const refreshQuery = force || refreshAssets ? '?refresh=1' : '';
        const response = await SLINK.core.http.requestJson('warWorker', `${SLINK.core.war.WORKER_BASE}/api/themes${refreshQuery}`, { cache:'no-store' });
        const catalog = SLINK.core.themes.installCatalog(response?.catalog);
        const record = { catalog, source:String(response?.source || 'worker'), fetchedAt:Date.now() };
        await SLINK.core.storage.set(SLINK.core.themes.CATALOG_STORAGE_KEY, record);
        return { ...record, error:'' };
      } catch (error) {
        if (cached) return { catalog:SLINK.core.themes.catalog(), source:String(cached.source || 'extension-cache'), fetchedAt:Number(cached.fetchedAt), error:SLINK.core.format.errorMessage(error) };
        return { catalog:SLINK.core.themes.catalog(), source:'bundled-fallback', fetchedAt:0, error:SLINK.core.format.errorMessage(error) };
      }
    })();
    try {
      return await loading;
    } finally {
      loading = null;
    }
  }

  SLINK.define('services', 'themes', Object.freeze({
    load,
    routes:Object.freeze({
      'themes.torn.get':async()=>{await tornSettingsQueue.catch(()=>{});return SLINK.core.storage.get(TORN_SETTINGS_KEY,{});},
      'themes.torn.patch':patchTornSettings,
      'themes.catalog': payload => load(payload?.force === true),
      'themes.refresh': () => load(true)
    })
  }));
})(globalThis);


