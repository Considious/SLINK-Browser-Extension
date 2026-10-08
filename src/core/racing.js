(function installRacingCore(global) {
  'use strict';

  const SLINK = global.SLINK_EXTENSION;
  if (!SLINK) throw new Error('SLINK runtime must load before Racing.');

  const MAX_NICKNAME_LENGTH = 22;
  const TRACK_ABBREVIATIONS = Object.freeze({
    'Underdog':'UndrDog',
    'Commerce':'Commer',
    'Sewage':'Sewage',
    'Meltdown':'Meltdwn',
    'Vector':'Vect',
    'Industrial':'Industria',
    'Withdrawal':'Withdraw',
    'Speedway':'Speedwy',
    'Uptown':'Uptow'
  });
  const RECOMMENDED_BUILDS = Object.freeze([
    { id:'a-colina-mudpit', class:'A', car:'Colina Tanprice', tracks:['Mudpit'], build:{ turbo:'Stage 3', transmission:'Long Ratio', gearbox:'Rally', tires:'Dirt' } },
    { id:'a-echo-stone-park', class:'A', car:'Echo R8', tracks:['Stone Park'], build:{ turbo:'Stage 3', transmission:'Short Ratio', gearbox:'Rally', tires:'Dirt' } },
    { id:'a-edmondo-parkland', class:'A', car:'Edmondo NSX', tracks:['Parkland'], build:{ turbo:'Stage 3', transmission:'Long Ratio', gearbox:'Rally', tires:'Dirt' } },
    { id:'a-edmondo-meltdown-vector-industrial', class:'A', car:'Edmondo NSX', tracks:['Meltdown','Vector','Industrial'], build:{ turbo:'Stage 3', transmission:'Short Ratio', gearbox:'Paddleshift', tires:'Tarmac' } },
    { id:'a-edmondo-two-islands', class:'A', car:'Edmondo NSX', tracks:['Two Islands'], build:{ turbo:'Stage 3', transmission:'Long Ratio', gearbox:'Rally', tires:'Dirt' } },
    { id:'a-edmondo-hammerhead', class:'A', car:'Edmondo NSX', tracks:['Hammerhead'], build:{ turbo:'Stage 2', transmission:'Short Ratio', gearbox:'Rally', tires:'Dirt' } },
    { id:'a-edmondo-underdog-commerce-sewage', class:'A', car:'Edmondo NSX', tracks:['Underdog','Commerce','Sewage'], build:{ turbo:'Stage 2', transmission:'Short Ratio', gearbox:'Paddleshift', tires:'Tarmac' } },
    { id:'a-mercia-convict', class:'A', car:'Mercia SLR', tracks:['Convict'], build:{ turbo:'Stage 3', transmission:'Long Ratio', gearbox:'Paddleshift', tires:'Tarmac' } },
    { id:'a-veloria-withdrawal-speedway-uptown', class:'A', car:'Veloria LFA', tracks:['Withdrawal','Speedway','Uptown'], build:{ turbo:'Stage 3', transmission:'Long Ratio', gearbox:'Paddleshift', tires:'Tarmac' } },
    { id:'a-volt-docks', class:'A', car:'Volt GT', tracks:['Docks'], build:{ turbo:'Stage 3', transmission:'Long Ratio', gearbox:'Paddleshift', tires:'Tarmac' } }
  ].map(entry => Object.freeze({ ...entry, tracks:Object.freeze([...entry.tracks]), build:Object.freeze({ ...entry.build }) })));

  const RACEWAY_DOM = Object.freeze({
    OFFICIAL_RACE_TRACK_SELECTOR:'.enlisted-btn-wrap',
    OFFICIAL_RACE_CAR_NAME_SELECTOR:'[class^="model-car-name-"],[class*=" model-car-name-"]',
    OFFICIAL_RACE_LABEL:'Official race'
  });

  const normalizeKey = value => String(value || '').trim().replace(/\s+/g, ' ').toLocaleLowerCase();
  const trackNames = Object.freeze([...new Set(RECOMMENDED_BUILDS.flatMap(entry => entry.tracks))]);
  const tracksByKey = new Map(trackNames.map(name => [normalizeKey(name), name]));

  function normalizeTrackName(value) {
    const candidate = String(value || '').trim().replace(/\s+/g, ' ');
    return tracksByKey.get(normalizeKey(candidate)) || null;
  }

  function defaultNicknameComponent(track) {
    const canonical = normalizeTrackName(track) || String(track || '').trim().replace(/\s+/g, ' ');
    if (!canonical) return '';
    if (TRACK_ABBREVIATIONS[canonical]) return TRACK_ABBREVIATIONS[canonical];
    const joined = canonical.replace(/[^a-z0-9]/gi, '');
    return joined.length <= 10 ? joined : joined.slice(0, 10);
  }

  function suggestNickname(tracks, maxLength = MAX_NICKNAME_LENGTH) {
    const components = (Array.isArray(tracks) ? tracks : []).map(defaultNicknameComponent).filter(Boolean);
    if (!components.length) return { value:'', length:0, maxLength, valid:false, shortened:false };
    let value = components.join('|');
    let shortened = false;
    while (value.length > maxLength) {
      let index = -1;
      for (let position = 0; position < components.length; position += 1) {
        if (components[position].length > 3 && (index < 0 || components[position].length > components[index].length)) index = position;
      }
      if (index < 0) break;
      components[index] = components[index].slice(0, -1);
      shortened = true;
      value = components.join('|');
    }
    return { value, length:value.length, maxLength, valid:Boolean(value) && value.length <= maxLength, shortened };
  }

  function validateNickname(value) {
    const name = String(value ?? '');
    return {
      value:name,
      length:name.length,
      maxLength:MAX_NICKNAME_LENGTH,
      valid:Boolean(name.trim()) && name.length <= MAX_NICKNAME_LENGTH,
      overBy:Math.max(0, name.length - MAX_NICKNAME_LENGTH)
    };
  }

  function normalizeUserState(value) {
    const input = value && typeof value === 'object' ? value : {};
    const builds = input.builds && typeof input.builds === 'object' ? input.builds : {};
    const normalized = {};
    for (const definition of RECOMMENDED_BUILDS) {
      const source = builds[definition.id] && typeof builds[definition.id] === 'object' ? builds[definition.id] : {};
      normalized[definition.id] = {
        completed:source.completed === true,
        customName:String(source.customName || '').slice(0, 100)
      };
    }
    return { view:['needed','completed','all'].includes(input.view) ? input.view : 'needed', builds:normalized };
  }

  function effectiveNickname(definition, userState) {
    const custom = String(userState?.builds?.[definition.id]?.customName || '').trim();
    return custom || suggestNickname(definition.tracks).value;
  }

  function buildsForView(view, userState) {
    const normalized = normalizeUserState(userState);
    return RECOMMENDED_BUILDS.filter(definition => {
      const complete = normalized.builds[definition.id].completed;
      return view === 'completed' ? complete : view === 'all' ? true : !complete;
    });
  }

  function recommendationForTrack(track, userState) {
    const canonical = normalizeTrackName(track);
    if (!canonical) return { status:'unknown-track', track:null, definition:null, nickname:'' };
    const definition = RECOMMENDED_BUILDS.find(entry => entry.tracks.includes(canonical)) || null;
    if (!definition) return { status:'no-build', track:canonical, definition:null, nickname:'' };
    const normalized = normalizeUserState(userState);
    const nickname = effectiveNickname(definition, normalized);
    if (!normalized.builds[definition.id].completed) return { status:'not-completed', track:canonical, definition, nickname };
    if (!validateNickname(nickname).valid) return { status:'invalid-nickname', track:canonical, definition, nickname };
    return { status:'ready', track:canonical, definition, nickname };
  }

  function matchVisibleCar(expectedNickname, candidates) {
    const expected = normalizeKey(expectedNickname);
    if (!expected) return null;
    return (Array.isArray(candidates) ? candidates : []).find(candidate => normalizeKey(candidate?.name ?? candidate?.textContent ?? candidate) === expected) || null;
  }

  function parseOfficialRaceTrack(text) {
    const match = String(text || '').trim().match(/^(.+?)\s*-\s*Official race\s*$/i);
    return match ? normalizeTrackName(match[1]) : null;
  }

  SLINK.define('core', 'racing', Object.freeze({
    MAX_NICKNAME_LENGTH,
    TRACK_ABBREVIATIONS,
    RECOMMENDED_BUILDS,
    RACEWAY_DOM,
    normalizeTrackName,
    defaultNicknameComponent,
    suggestNickname,
    validateNickname,
    normalizeUserState,
    effectiveNickname,
    buildsForView,
    recommendationForTrack,
    matchVisibleCar,
    parseOfficialRaceTrack
  }));
})(globalThis);
