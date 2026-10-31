(function installSharedDataService(global) {
  'use strict';
  const SLINK = global.SLINK_EXTENSION;
  const KEY = 'shared.providers.v1';
  const provider = SLINK.core.sharedData.create({
    read:() => SLINK.core.storage.get(KEY, {}),
    write:value => SLINK.core.storage.set(KEY, value),
    normalizeItems:body => SLINK.core.market.catalogItems(body),
    async request(kind, key) {
      const endpoint = kind === 'personal' ? '/v2/user?selections=battlestats%2Cbasic' : '/v2/torn/items?cat=All&sort=ASC';
      await SLINK.core.tornApiLimiter.reserve({ wait:true, priority:'high', endpoint });
      return SLINK.core.http.requestJson('tornApi', 'https://api.torn.com' + endpoint + '&comment=SLINK%20shared%20data', {
        headers:{ Authorization:`ApiKey ${key}` }, cache:'no-store'
      });
    }
  });
  SLINK.define('services', 'sharedData', provider);
})(globalThis);
