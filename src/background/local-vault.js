(function installLocalVault(global) {
  'use strict';

  const DB_NAME = 'slink-durable-storage';
  const DB_VERSION = 1;
  const STORE_NAME = 'records';
  let databasePromise = null;
  let lastRecovery = { available:false, recovered:0, checkedAt:0 };

  function available() {
    return typeof global.indexedDB?.open === 'function';
  }

  function durableKey(key) {
    const value = String(key || '');
    return value.startsWith('slink.') && (
      /\.settings\.v\d+$/.test(value) ||
      /\.acceptedTerms\.v\d+$/.test(value) ||
      value.startsWith('slink.ui.') ||
      value === 'slink.contribution.managementToken'
    );
  }

  function requestResult(request) {
    return new Promise((resolve, reject) => {
      request.addEventListener('success', () => resolve(request.result), { once:true });
      request.addEventListener('error', () => reject(request.error || new Error('IndexedDB request failed.')), { once:true });
    });
  }

  function database() {
    if (!available()) return Promise.resolve(null);
    if (databasePromise) return databasePromise;
    databasePromise = new Promise((resolve, reject) => {
      const request = global.indexedDB.open(DB_NAME, DB_VERSION);
      request.addEventListener('upgradeneeded', () => {
        if (!request.result.objectStoreNames.contains(STORE_NAME)) request.result.createObjectStore(STORE_NAME, { keyPath:'key' });
      });
      request.addEventListener('success', () => resolve(request.result), { once:true });
      request.addEventListener('error', () => reject(request.error || new Error('SLINK local vault could not be opened.')), { once:true });
    });
    return databasePromise;
  }

  async function records() {
    const db = await database();
    if (!db) return [];
    return requestResult(db.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).getAll());
  }

  async function write(key, value) {
    if (!durableKey(key)) return false;
    const db = await database();
    if (!db) return false;
    await requestResult(db.transaction(STORE_NAME, 'readwrite').objectStore(STORE_NAME).put({ key, value, updatedAt:Date.now() }));
    return true;
  }

  async function remove(key) {
    if (!durableKey(key)) return false;
    const db = await database();
    if (!db) return false;
    await requestResult(db.transaction(STORE_NAME, 'readwrite').objectStore(STORE_NAME).delete(String(key)));
    return true;
  }

  async function snapshot() {
    if (!available()) return { available:false, saved:0 };
    const stored = await chrome.storage.local.get(null);
    const durable = Object.entries(stored || {}).filter(([key]) => durableKey(key));
    await Promise.all(durable.map(([key, value]) => write(key, value)));
    return { available:true, saved:durable.length };
  }

  async function restoreMissing() {
    if (!available()) {
      lastRecovery = { available:false, recovered:0, checkedAt:Date.now() };
      return lastRecovery;
    }
    const saved = await records();
    const stored = await chrome.storage.local.get(saved.map(record => record.key));
    const missing = Object.fromEntries(saved.filter(record => !Object.prototype.hasOwnProperty.call(stored, record.key)).map(record => [record.key, record.value]));
    const keys = Object.keys(missing);
    if (keys.length) await chrome.storage.local.set(missing);
    lastRecovery = { available:true, recovered:keys.length, recoveredKeys:keys, checkedAt:Date.now() };
    if (keys.length) console.warn(`[SLINK] Recovered ${keys.length} durable setting${keys.length === 1 ? '' : 's'} from the local vault.`);
    return lastRecovery;
  }

  function status() {
    return { ...lastRecovery };
  }

  chrome.storage.onChanged?.addListener((changes, areaName) => {
    if (areaName !== 'local') return;
    const durable = Object.entries(changes || {}).filter(([key]) => durableKey(key));
    if (!durable.length) return;
    const writes = durable.filter(([, change]) => Object.prototype.hasOwnProperty.call(change, 'newValue'));
    const removals = durable.filter(([, change]) => !Object.prototype.hasOwnProperty.call(change, 'newValue'));
    const suspiciousBulkRemoval = removals.length >= 3 && writes.length === 0;
    for (const [key, change] of writes) void write(key, change.newValue).catch(error => console.error('[SLINK] Local vault write:', error));
    if (!suspiciousBulkRemoval) {
      for (const [key] of removals) void remove(key).catch(error => console.error('[SLINK] Local vault remove:', error));
    } else {
      console.warn(`[SLINK] Preserved the local vault after ${removals.length} durable settings disappeared together.`);
    }
  });

  Object.defineProperty(global, 'SLINK_LOCAL_VAULT', {
    value:Object.freeze({ durableKey, remove, restoreMissing, snapshot, status, write }),
    enumerable:false,
    configurable:false,
    writable:false
  });
})(globalThis);
