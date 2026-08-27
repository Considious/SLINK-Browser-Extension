(function installThemeService(global) {
  'use strict';

  const SLINK = global.SLINK_EXTENSION;
  const MAX_AGE_MS = 12 * 60 * 60 * 1000;
  let loading = null;

  async function cachedRecord() {
    const record = await SLINK.core.storage.get(SLINK.core.themes.CATALOG_STORAGE_KEY, null);
    if (!record?.catalog) return null;
    try {
      SLINK.core.themes.installCatalog(record.catalog);
      return record;
    } catch {
      await SLINK.core.storage.remove(SLINK.core.themes.CATALOG_STORAGE_KEY);
      return null;
    }
  }

  async function load(force = false) {
    if (loading) return loading;
    loading = (async () => {
      const cached = await cachedRecord();
      if (!force && cached && Date.now() - Number(cached.fetchedAt) < MAX_AGE_MS) {
        return { catalog:SLINK.core.themes.catalog(), source:String(cached.source || 'extension-cache'), fetchedAt:Number(cached.fetchedAt), error:'' };
      }
      try {
        const response = await SLINK.core.http.requestJson('warWorker', `${SLINK.core.war.WORKER_BASE}/api/themes`, { cache:'no-store' });
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
      'themes.catalog': () => load(false),
      'themes.refresh': () => load(true)
    })
  }));
})(globalThis);
