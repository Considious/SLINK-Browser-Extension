(function installPlayerIntelligenceStore(global) {
  'use strict';
  const SLINK = global.SLINK_EXTENSION;
  const LEGACY_KEY = 'playerIntelligence.cache.v1';
  const DB_NAME = 'slink-player-intelligence';
  const MARKER = 'chrome-cache-v1-imported';
  let opening = null;
  let preparing = null;

  function available() { return typeof global.indexedDB?.open === 'function'; }
  async function fingerprint(value) {
    if (value == null) return null;
    return [...new Uint8Array(await global.crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(value))))]
      .map(byte => byte.toString(16).padStart(2, '0')).join('');
  }

  function database() {
    if (opening) return opening;
    opening = new Promise((resolve, reject) => {
      let abandoned = false;
      const request = global.indexedDB.open(DB_NAME, 1);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains('players')) db.createObjectStore('players', { keyPath:'id' });
        if (!db.objectStoreNames.contains('meta')) db.createObjectStore('meta', { keyPath:'key' });
      };
      request.onsuccess = () => {
        const db = request.result;
        if (abandoned) { db.close(); return; }
        db.onversionchange = () => { db.close(); opening = null; preparing = null; };
        resolve(db);
      };
      request.onerror = () => reject(request.error || new Error('The player database could not be opened. Existing data was not removed.'));
      request.onblocked = () => { abandoned = true; reject(new Error('The player database is waiting for an older connection to close. Existing data was not removed.')); };
    }).catch(error => { opening = null; throw error; });
    return opening;
  }

  function transaction(db, stores, mode, action) {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(stores, mode);
      let result;
      tx.oncomplete = () => resolve(result);
      tx.onabort = () => reject(tx.error || new Error('Player database transaction was interrupted. Existing data was not removed.'));
      tx.onerror = () => { /* onabort reports the final failed transaction. */ };
      try { action(tx, value => { result = value; }); }
      catch (error) { try { tx.abort(); } catch {} reject(error); }
    });
  }

  async function prepare() {
    if (!available()) return { available:false, migrated:false };
    if (preparing) return preparing;
    preparing = (async () => {
      const db = await database();
      const legacy = await SLINK.core.storage.get(LEGACY_KEY, null);
      const digest = await fingerprint(legacy);
      const result = await transaction(db, ['players','meta'], 'readwrite', (tx, done) => {
        const meta = tx.objectStore('meta');
        const marker = meta.get(MARKER);
        marker.onsuccess = () => {
          if (marker.result && (legacy == null || marker.result.digest === digest)) {
            done({ available:true, migrated:false, records:marker.result.records }); return;
          }
          const players = tx.objectStore('players');
          let records = 0;
          const extras = Object.assign(Object.create(null), marker.result?.extras || {});
          for (const [key, record] of Object.entries(legacy && typeof legacy === 'object' && !Array.isArray(legacy) ? legacy : {})) {
            const id = SLINK.core.playerIntelligence.validPlayerId(key);
            if (!id || !record || typeof record !== 'object' || Array.isArray(record)) { extras[key] = record; continue; }
            const existing = players.get(id);
            existing.onsuccess = () => {
              try {
                const previous = existing.result?.record;
                // Stable's legacy merge has no per-field clocks: apply the newer
                // observation last when reconciling a rollback-created Chrome copy.
                const age = value => Math.max(Number(value?.observedAt) || 0, Number(value?.checkedAt) || 0);
                const [older, newer] = previous && age(previous) > age(record) ? [record, previous] : [previous, record];
                const merged = previous
                  ? { ...older, ...newer, ...SLINK.core.playerIntelligence.mergeRecord(older, newer) }
                  : record;
                players.put({ id, record:merged });
              } catch { tx.abort(); }
            };
            records++;
          }
          meta.put({ key:MARKER, digest, records, importedAt:Date.now(), extras });
          done({ available:true, migrated:true, records });
        };
      });
      // Never free the old quota-limited copy on a request's success event:
      // the whole transaction, including its import marker, must commit first.
      const currentLegacy = await SLINK.core.storage.get(LEGACY_KEY, null);
      if (currentLegacy != null) {
        if (await fingerprint(currentLegacy) !== digest) {
          throw new Error('The old player cache changed during migration. Both copies were kept; retry after the restore finishes.');
        }
        await SLINK.core.storage.remove(LEGACY_KEY);
      }
      return result;
    })().catch(error => { preparing = null; throw error; });
    return preparing;
  }

  async function get(id) {
    await prepare();
    const db = await database();
    return transaction(db, ['players'], 'readonly', (tx, done) => {
      const request = tx.objectStore('players').get(Number(id));
      request.onsuccess = () => done(request.result?.record || null);
    });
  }

  async function all() {
    await prepare();
    const db = await database();
    return transaction(db, ['players'], 'readonly', (tx, done) => {
      const request = tx.objectStore('players').getAll();
      request.onsuccess = () => done(Object.fromEntries(request.result.map(row => [String(row.id), row.record])));
    });
  }

  async function putMany(records) {
    await prepare();
    const db = await database();
    await transaction(db, ['players'], 'readwrite', tx => {
      const store = tx.objectStore('players');
      for (const [key, record] of Object.entries(records)) {
        const id = SLINK.core.playerIntelligence.validPlayerId(key);
        if (!id) throw new Error('Invalid player database record ID.');
        store.put({ id, record });
      }
    });
  }

  SLINK.define('services', 'playerIntelligenceStore', Object.freeze({ available, prepare, get, all, putMany }));
})(globalThis);
