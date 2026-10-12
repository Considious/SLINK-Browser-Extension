(function installMuseumCore(global) {
  'use strict';

  const SLINK = global.SLINK_EXTENSION;
  if (!SLINK) throw new Error('SLINK runtime must load before Museums.');

  const SCOPE = 'slink.qol.museum';
  const CACHE_MS = 60 * 60_000;
  const CATALOG_MS = 7 * 86_400_000;
  const item = (name, amount = 1) => Object.freeze({ name, amount });

  const SETS = Object.freeze([
    Object.freeze({ id:'plushies', name:'Plushie Set', points:10, travel:true, items:Object.freeze([
      item('Jaguar Plushie'), item('Lion Plushie'), item('Panda Plushie'), item('Monkey Plushie'), item('Chamois Plushie'),
      item('Wolverine Plushie'), item('Nessie Plushie'), item('Red Fox Plushie'), item('Camel Plushie'), item('Kitten Plushie'),
      item('Teddy Bear Plushie'), item('Sheep Plushie'), item('Stingray Plushie')
    ]) }),
    Object.freeze({ id:'flowers', name:'Exotic Flower Set', points:10, travel:true, items:Object.freeze([
      item('Dahlia'), item('Orchid'), item('African Violet'), item('Cherry Blossom'), item('Peony'), item('Ceibo Flower'),
      item('Edelweiss'), item('Crocus'), item('Heather'), item('Tribulus Omanense'), item('Banana Orchid')
    ]) }),
    Object.freeze({ id:'meteorite', name:'Meteorite Fragment', points:15, items:Object.freeze([item('Meteorite Fragment')]) }),
    Object.freeze({ id:'fossil', name:'Patagonian Fossil', points:20, items:Object.freeze([item('Patagonian Fossil')]) }),
    Object.freeze({ id:'arrowheads', name:'Arrowhead Set', points:25, items:Object.freeze([
      item('Obsidian Point'), item('Quartz Point'), item('Basalt Point'), item('Chert Point'), item('Chalcedony Point'), item('Quartzite Point')
    ]) }),
    Object.freeze({ id:'medieval-coins', name:'Medieval Coin Set', points:100, items:Object.freeze([
      item('Leopard Coin'), item('Florin Coin'), item('Gold Noble Coin')
    ]) }),
    Object.freeze({ id:'vairocana', name:'Vairocana Buddha', points:100, items:Object.freeze([item('Vairocana Buddha Sculpture')]) }),
    Object.freeze({ id:'ganesha', name:'Ganesha Sculpture', points:250, items:Object.freeze([item('Ganesha Sculpture')]) }),
    Object.freeze({ id:'shabti', name:'Shabti Sculpture', points:500, items:Object.freeze([item('Shabti Sculpture')]) }),
    Object.freeze({ id:'companion-scripts', name:'Companion Scripts', points:1000, items:Object.freeze([
      item('Companion Script : Abdullah'), item('Companion Script : Ali'), item('Companion Script : Ubay')
    ]) }),
    Object.freeze({ id:'senet', name:'Senet Game Set', points:2000, items:Object.freeze([
      item('Senet board'), item('White Senet pawn', 5), item('Black Senet pawn', 5)
    ]) }),
    Object.freeze({ id:'amulet', name:'Egyptian Amulet', points:10000, items:Object.freeze([item('Egyptian Amulet')]) })
  ]);

  const ALIASES = Object.freeze({
    'quran script : ibn masud':'Companion Script : Abdullah',
    'quran script : ali':'Companion Script : Ali',
    "quran script : ubay ibn ka'b":'Companion Script : Ubay',
    'script from the quran: ibn masud':'Companion Script : Abdullah',
    'script from the quran: ali':'Companion Script : Ali',
    "script from the quran: ubay ibn ka'b":'Companion Script : Ubay'
  });

  function key(value) {
    return String(value || '').trim().replace(/\s+/g, ' ').toLowerCase();
  }

  function canonicalName(value) {
    const text = String(value || '').trim().replace(/\s+/g, ' ');
    return ALIASES[key(text)] || text;
  }

  function inventoryMap(payload = {}) {
    const rows = Array.isArray(payload?.inventory?.items)
      ? payload.inventory.items
      : Array.isArray(payload?.items) ? payload.items : [];
    const map = new Map();
    for (const row of rows) {
      const name = canonicalName(row?.name);
      if (!name) continue;
      const mapKey = key(name);
      const previous = map.get(mapKey) || { id:Number(row?.id) || 0, name, amount:0 };
      previous.amount += Math.max(0, Math.trunc(Number(row?.amount) || 0));
      if (!previous.id) previous.id = Number(row?.id) || 0;
      map.set(mapKey, previous);
    }
    return map;
  }

  function catalogMap(rows = []) {
    const map = new Map();
    for (const row of rows) {
      const name = canonicalName(row?.name);
      if (name) map.set(key(name), { ...row, name });
    }
    return map;
  }

  function buildStatus(inventoryPayload, catalogRows = []) {
    const owned = inventoryMap(inventoryPayload);
    const catalog = catalogMap(catalogRows);
    const sets = SETS.map(definition => {
      const items = definition.items.map(required => {
        const name = canonicalName(required.name);
        const inventory = owned.get(key(name));
        const catalogItem = catalog.get(key(name));
        const amount = Number(inventory?.amount) || 0;
        const needed = Math.max(0, required.amount - amount);
        return {
          name,
          required:required.amount,
          owned:amount,
          needed,
          complete:needed === 0,
          itemId:Number(catalogItem?.id || inventory?.id) || 0,
          marketPrice:Math.max(0, Number(catalogItem?.marketPrice) || 0),
          type:String(catalogItem?.type || ''),
          image:String(catalogItem?.image || '')
        };
      });
      const completeSets = Math.min(...items.map(entry => Math.floor(entry.owned / entry.required)));
      return {
        id:definition.id,
        name:definition.name,
        points:definition.points,
        travel:definition.travel === true,
        complete:items.every(entry => entry.complete),
        completeSets:Number.isFinite(completeSets) ? completeSets : 0,
        items
      };
    });
    return {
      sets,
      summary:{
        completed:sets.filter(entry => entry.complete).length,
        total:sets.length,
        redeemablePoints:sets.reduce((sum, entry) => sum + entry.completeSets * entry.points, 0)
      }
    };
  }

  function setById(id) {
    return SETS.find(entry => entry.id === String(id || '')) || null;
  }

  SLINK.define('core', 'museum', Object.freeze({
    SCOPE,
    CACHE_MS,
    CATALOG_MS,
    SETS,
    buildStatus,
    canonicalName,
    inventoryMap,
    setById
  }));
})(globalThis);
