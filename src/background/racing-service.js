(function installRacingService(global) {
  'use strict';
  const SLINK = global.SLINK_EXTENSION;
  const racing = SLINK.core.racing;
  const KEY = 'racing.buildGuide.v1';
  let queue = Promise.resolve();

  async function status() {
    return { state:racing.normalizeUserState(await SLINK.core.storage.get(KEY, null)) };
  }

  function save(patch = {}) {
    // Copy intent before awaiting another caller. Only known fields may change.
    const intent = { ...patch };
    const operation = queue.catch(() => {}).then(async () => {
      const raw = await SLINK.core.storage.get(KEY, {});
      const previous = raw && typeof raw === 'object' ? raw : {};
      const next = { ...previous, builds:{ ...previous.builds } };
      const acknowledged = {};
      for (const [field,value] of Object.entries(intent)) {
        if (field === 'view') {
          if (!['needed','completed','all'].includes(value)) throw new Error('Choose Needed, Completed or All.');
          next.view = value; acknowledged.view = value; continue;
        }
        const definition = racing.RECOMMENDED_BUILDS.find(build => field === `${build.id}:name` || field === `${build.id}:completed`);
        if (!definition) throw new Error('Unknown Racing setting.');
        const current = { ...next.builds[definition.id] };
        if (field.endsWith(':completed')) {
          if (typeof value !== 'boolean') throw new Error('Completion must be true or false.');
          current.completed = value; acknowledged[field] = value;
        } else {
          const name = String(value ?? '').trim();
          if (!racing.validateNickname(name).valid) throw new Error('Enter a nickname from 1 to 22 characters.');
          const suggested = racing.suggestNickname(definition.tracks).value;
          current.customName = name === suggested ? '' : name;
          acknowledged[field] = name;
        }
        next.builds[definition.id] = current;
      }
      if (Object.keys(acknowledged).length) await SLINK.core.storage.set(KEY, next);
      return { settings:acknowledged };
    });
    queue = operation;
    return operation;
  }

  SLINK.define('services','racing',Object.freeze({ status,save,routes:Object.freeze({
    'racing.status':status,
    'racing.settings.save':payload => save(payload?.settings || {})
  }) }));
})(globalThis);
