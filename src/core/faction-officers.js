(function installFactionOfficerCore(global) {
  'use strict';
  const SLINK = global.SLINK_EXTENSION;
  if (!SLINK) throw new Error('SLINK runtime must load before faction officer helpers.');

  const OFFICER_SCOPE = 'slink.war.officer';
  const ARMORY_SCOPE = 'slink.officer.armory';
  const OC_SCOPE = 'slink.officer.oc';
  const ADMIN_SCOPE = 'admin.*';
  const ARMORY_URL = 'https://www.torn.com/factions.php?step=your#/tab=armoury';
  const CRIMES_URL = 'https://www.torn.com/factions.php?step=your#/tab=crimes';
  const INVENTORY_CATEGORIES = Object.freeze([
    'weapons','temporary','medical','consumables','drugs','boosters','utilities'
  ]);

  function item(key, name, category, aliases = []) {
    return Object.freeze({ key, name, category, aliases:Object.freeze(aliases) });
  }

  const ARMORY_ITEMS = Object.freeze([
    item('blood-a-pos','Blood Bag : A+','medical'),
    item('blood-a-neg','Blood Bag : A-','medical'),
    item('blood-b-pos','Blood Bag : B+','medical'),
    item('blood-b-neg','Blood Bag : B-','medical'),
    item('blood-ab-pos','Blood Bag : AB+','medical'),
    item('blood-ab-neg','Blood Bag : AB-','medical'),
    item('blood-o-pos','Blood Bag : O+','medical'),
    item('blood-o-neg','Blood Bag : O-','medical'),
    item('blood-irradiated','Blood Bag : Irradiated','medical'),
    item('empty-blood-bag','Empty Blood Bag','medical',['Empty Blood Bags']),
    item('morphine','Morphine','medical'),
    item('small-first-aid-kit','Small First Aid Kit','medical',['Small First Aid Kits']),
    item('first-aid-kit','First Aid Kit','medical'),
    item('xanax','Xanax','drugs'),
    item('pepper-spray','Pepper Spray','temporary'),
    item('points','Points','points')
  ]);

  const OC_ITEMS = Object.freeze([
    item('blank-casino-chips','Blank Casino Chips','consumables'),
    item('id-badge','ID Badge','utilities'),
    item('tunneling-virus','Tunneling Virus','utilities'),
    item('zip-ties','Zip Ties','consumables'),
    item('dog-treats','Dog Treats','consumables'),
    item('pcp','PCP','drugs'),
    item('cell-phone','Cell Phone','utilities'),
    item('shaving-foam','Shaving Foam','consumables'),
    item('atm-key','ATM Key','utilities'),
    item('gasoline','Gasoline','consumables'),
    item('polymorphic-virus','Polymorphic Virus','utilities'),
    item('black-spray-paint','Spray Paint : Black','consumables',['Black Spray Paint']),
    item('chloroform','Chloroform','medical'),
    item('c4-explosive','C4 Explosive','utilities'),
    item('flash-grenade','Flash Grenade','temporary'),
    item('ipecac-syrup','Ipecac Syrup','medical'),
    item('thermite','Thermite','consumables'),
    item('firewalk-virus','Firewalk Virus','utilities'),
    item('shaped-charge','Shaped Charge','utilities'),
    item('razor-wire','Razor Wire','utilities'),
    item('floor-cleaner','Floor Cleaner','consumables'),
    item('single-red-rose','Single Red Rose','consumables'),
    item('syringe','Syringe','medical'),
    item('smoke-grenade','Smoke Grenade','temporary'),
    item('stealth-virus','Stealth Virus','utilities'),
    item('ecstasy','Ecstasy','drugs'),
    item('lubricant','Lubricant','consumables'),
    item('armored-virus','Armored Virus','utilities'),
    item('psu','PSU','utilities'),
    item('hard-drive','Hard Drive','utilities'),
    item('igniter-cord','Igniter Cord','utilities'),
    item('nail-bomb','Nail Bomb','temporary'),
    item('tear-gas','Tear Gas','temporary'),
    item('lockpicks','Lockpicks','utilities'),
    item('jemmy','Jemmy','utilities'),
    item('net','Net','utilities'),
    item('cassock','Cassock','utilities'),
    item('police-badge','Police Badge','utilities'),
    item('rf-detector','RF Detector','utilities'),
    item('dslr-camera','DSLR Camera','utilities'),
    item('construction-helmet','Construction Helmet','utilities'),
    item('wire-cutters','Wire Cutters','utilities'),
    item('billfold','Billfold','utilities'),
    item('bolt-cutters','Bolt Cutters','utilities'),
    item('dental-mirror','Dental Mirror','utilities'),
    item('core-drill','Core Drill','utilities'),
    item('ladder','Ladder','utilities'),
    item('angle-grinder','Angle Grinder','utilities'),
    item('large-suitcase','Large Suitcase','utilities'),
    item('hand-drill','Hand Drill','utilities'),
    item('tracking-device','Tracking Device','utilities'),
    item('bone-saw','Bone Saw','utilities'),
    item('wireless-dongle','Wireless Dongle','utilities'),
    item('cut-throat-razor','Cut-Throat Razor','utilities'),
    item('china-lake','China Lake','weapons'),
    item('binoculars','Binoculars','utilities'),
    item('remote-detonator','Remote Detonator','utilities'),
    item('car-battery','Car Battery','utilities'),
    item('cigar-cutter','Cigar Cutter','utilities')
  ]);

  function normalizeName(value) {
    return String(value || '').trim().replace(/\s+/g, ' ').toLowerCase();
  }

  function normalizeThresholds(input, definitions) {
    const source = input && typeof input === 'object' ? input : {};
    return Object.fromEntries(definitions.map(definition => [
      definition.key,
      Math.max(0, Math.trunc(Number(source[definition.key]) || 0))
    ]));
  }

  function inventoryAmounts(rows = [], points = 0) {
    const totals = new Map();
    for (const row of Array.isArray(rows) ? rows : []) {
      const key = normalizeName(row?.name);
      if (!key) continue;
      totals.set(key, (totals.get(key) || 0) + Math.max(0, Math.trunc(Number(row?.amount) || 0)));
    }
    totals.set('points', Math.max(0, Math.trunc(Number(points) || 0)));
    return totals;
  }

  function amountFor(definition, totals) {
    const names = [definition.name, ...(definition.aliases || [])].map(normalizeName);
    return Math.max(0, ...names.map(name => Number(totals.get(name)) || 0));
  }

  function shortages(definitions, thresholds, rows, points = 0) {
    const totals = inventoryAmounts(rows, points);
    return definitions.flatMap(definition => {
      const target = Math.max(0, Math.trunc(Number(thresholds?.[definition.key]) || 0));
      if (!target) return [];
      const current = amountFor(definition, totals);
      return current < target ? [{ ...definition, current, target }] : [];
    });
  }

  function restockMessage(title, rows) {
    return [title, ...rows.map(row => `${row.name} ${row.current}/${row.target}`)].join('\n');
  }

  function missingCrimeMessage(rows) {
    return ['OC Items Missing:', ...rows.map(row => `${row.userName} [${row.userId}] — ${row.itemName} for ${row.crimeName}`)].join('\n');
  }

  function itemCatalog(payload = {}) {
    const rows = Array.isArray(payload?.items) ? payload.items : Object.values(payload?.items || {});
    return new Map(rows.map(row => [Number(row?.id), String(row?.name || `Item ${row?.id}`)]).filter(([id]) => id > 0));
  }

  function memberCatalog(payload = {}) {
    const source = payload?.members ?? payload?.faction?.members ?? [];
    const rows = Array.isArray(source) ? source : Object.entries(source || {}).map(([id,row]) => ({ id, ...(row || {}) }));
    return new Map(rows.map(row => [Number(row?.id ?? row?.user_id), String(row?.name || `Player ${row?.id ?? row?.user_id}`)]).filter(([id]) => id > 0));
  }

  function missingCrimeItems(payload = {}, itemNames = new Map(), memberNames = new Map()) {
    const crimes = Array.isArray(payload?.crimes) ? payload.crimes : [];
    const rows = [];
    for (const crime of crimes) {
      if (!['Recruiting','Planning'].includes(String(crime?.status || ''))) continue;
      for (const slot of Array.isArray(crime?.slots) ? crime.slots : []) {
        const requirement = slot?.item_requirement;
        const userId = Number(slot?.user?.id);
        const itemId = Number(requirement?.id);
        if (!userId || !itemId || requirement?.is_available !== false) continue;
        rows.push({
          crimeId:Number(crime?.id) || 0,
          crimeName:String(crime?.name || 'Organized Crime'),
          position:String(slot?.position_info?.label || slot?.position || 'Assigned slot'),
          userId,
          userName:memberNames.get(userId) || String(slot?.user?.name || `Player ${userId}`),
          itemId,
          itemName:itemNames.get(itemId) || `Item ${itemId}`,
          reusable:requirement?.is_reusable === true
        });
      }
    }
    return rows;
  }

  SLINK.define('core','factionOfficers',Object.freeze({
    OFFICER_SCOPE,ARMORY_SCOPE,OC_SCOPE,ADMIN_SCOPE,ARMORY_URL,CRIMES_URL,
    INVENTORY_CATEGORIES,ARMORY_ITEMS,OC_ITEMS,normalizeThresholds,
    shortages,restockMessage,missingCrimeMessage,itemCatalog,memberCatalog,missingCrimeItems
  }));
})(globalThis);
