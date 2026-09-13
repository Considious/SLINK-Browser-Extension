(function installStorage(global) {
  'use strict';

  const SLINK = global.SLINK_EXTENSION;
  if (!SLINK) throw new Error('SLINK runtime must load before storage.');

  function fullKey(key) {
    const normalized = String(key || '').trim();
    if (!normalized) throw new Error('A SLINK storage key is required.');
    return `${SLINK.STORAGE_PREFIX}${normalized}`;
  }

  async function get(key, fallback = undefined) {
    const storageKey = fullKey(key);
    const values = await chrome.storage.local.get(storageKey);
    return Object.prototype.hasOwnProperty.call(values, storageKey)
      ? values[storageKey]
      : fallback;
  }

  async function set(key, value) {
    await chrome.storage.local.set({ [fullKey(key)]: value });
    return value;
  }

  async function remove(key) {
    await chrome.storage.local.remove(fullKey(key));
  }

  async function update(key, updater, fallback = undefined) {
    if (typeof updater !== 'function') throw new TypeError('Storage updater must be a function.');
    const current = await get(key, fallback);
    const next = await updater(current);
    return set(key, next);
  }

  async function exportNamespace() {
    const stored = await chrome.storage.local.get(null);
    const values = Object.create(null);
    for (const [key, value] of Object.entries(stored || {})) {
      if (key.startsWith(SLINK.STORAGE_PREFIX)) values[key] = value;
    }
    return {
      schemaVersion:1,
      product:'SLINK Browser Extension',
      extensionVersion:SLINK.VERSION,
      exportedAt:new Date().toISOString(),
      values
    };
  }

  async function importNamespace(backup) {
    if (!backup || typeof backup !== 'object' || Number(backup.schemaVersion) !== 1 || !backup.values || typeof backup.values !== 'object' || Array.isArray(backup.values)) {
      throw new Error('This is not a valid SLINK backup file.');
    }
    const values = Object.create(null);
    for (const [key, value] of Object.entries(backup.values)) {
      if (key.startsWith(SLINK.STORAGE_PREFIX)) values[key] = value;
    }
    const restoredKeys = Object.keys(values);
    if (!restoredKeys.length) throw new Error('The backup does not contain any SLINK settings.');
    await chrome.storage.local.set(values);
    return { restored:restoredKeys.length, exportedAt:String(backup.exportedAt || '') };
  }

  SLINK.define('core', 'storage', Object.freeze({
    exportNamespace,
    fullKey,
    get,
    importNamespace,
    remove,
    set,
    update
  }));
})(globalThis);
