(function startKalSettings(global) {
  'use strict';
  const send=(type,payload)=>global.SLINK_EXTENSION.core.messaging.send('kal.'+type,payload);
  global.SLINK_KAL_UI.mountSettings(document.getElementById('kal-settings'),{
    status:()=>send('status'),connect:(key,consent)=>send('connect',{key,consent}),
    configure:settings=>send('configure',settings),disconnect:()=>send('disconnect')
  });
})(globalThis);
