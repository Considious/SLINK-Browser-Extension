import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');
let now=1800000000000;
class Clock extends Date {static now(){return now;}}
const values=new Map(), context=vm.createContext({console,Date:Clock,URL,setTimeout,clearTimeout,structuredClone});
for(const file of ['runtime','format','permissions','adhd'])vm.runInContext(read('src/core/'+file+'.js'),context);
const api=context.SLINK_EXTENSION;
api.core.storage={get:async(key,fallback)=>structuredClone(values.has(key)?values.get(key):fallback),set:async(key,value)=>{values.set(key,structuredClone(value));}};
api.core.tornApiLimiter={getUsage:async()=>({})};
api.services.permissionAccess={status:async()=>({configured:false})};
let company=[{id:'company:addiction:self',title:'Rehab',links:[]}];
const empty={activeAlerts:async()=>[],publicStatus:async()=>({settings:{soundEnabled:true}})};
api.services.targetList=empty;api.services.abroadStocks=empty;api.services.moneyProperty=empty;api.services.factionOfficer={...empty,activeAlerts:async()=>[{id:'factionOnboarding:42:123',kind:'faction-onboarding'}]};
api.services.company={activeAlerts:async()=>company};
vm.runInContext(read('src/background/adhd-service.js'),context);
const routes=api.services.adhd.routes;
assert.equal((await api.services.adhd.publicStatus(false)).activeAlerts.some(x=>x.id===company[0].id),true);
let status=await routes['adhd.alert.snooze']({id:company[0].id,durationMs:43200000});
assert.equal(values.get('adhd.settings.v1').snoozedUntil[company[0].id],now+43200000);
assert.equal(status.activeAlerts.some(x=>x.id===company[0].id),false,'Company snooze must remove the actual Alerts-page row');
let sound=await routes['adhd.sound.claim']();assert.equal(sound.alertIds.includes(company[0].id),false,'Snoozed company alerts cannot claim sound');
// Recreate the service to exercise the durable ledger rather than closure state.
assert.equal((await api.services.adhd.publicStatus(false)).activeAlerts.some(x=>x.id===company[0].id),false);
now+=43200001;assert.equal((await api.services.adhd.publicStatus(false)).activeAlerts.some(x=>x.id===company[0].id),true,'Expired snooze resumes');
await api.services.adhd.routes['adhd.alert.snooze']({id:'factionOnboarding:42:123',durationMs:43200000});
assert.equal((await api.services.adhd.publicStatus(false)).activeAlerts.some(x=>x.id.startsWith('factionOnboarding:')),false);
await assert.rejects(api.services.adhd.routes['adhd.alert.snooze']({id:'invented:alert'}),/no longer active/);

const source=read('src/modules/war.js');
function extract(name,sourceText=source,indent=6){const start=sourceText.search(new RegExp('^'+ ' '.repeat(indent)+'(?:async )?function '+name+'\\(','m'));assert(start>=0,name);const lines=sourceText.slice(start).split('\n');let s='';for(const line of lines){s+=line+'\n';try{new vm.Script(s);return s;}catch(e){if(!(e instanceof SyntaxError))throw e;}}throw Error(name);}
let tones=0,count=0;
const war=vm.createContext({Date:Clock,Number,Boolean,Set,Map,current:{settings:{alertSound:true,retalAlerts:true,retalSound:true},runtime:{snapshot:{retals:[{attackId:'a',attackerId:42,expiresAt:now/1000+500}]},panelStats:{}},session:{}},dismissedRetalMap:{},opponentMemberIds:()=>new Set(),lastAlertSignature:'',fullUi:false,context:{ui:{setAlertCount:(_id,n)=>{count=n;},setBubbleAlert(){}}},playAlertTone:()=>{tones++;},setPageAlert(){}});
for(const name of ['retalDismissKey','visibleRetals','evaluateAlerts'])vm.runInContext(extract(name),war);
war.evaluateAlerts();assert.equal(tones,1);assert.equal(count,1);
war.current.settings.retalSound=false;war.evaluateAlerts();assert.equal(count,1,'Mute preserves visual alerts');assert.equal(tones,1);
war.current.runtime.snapshot.retals.push({attackId:'b',attackerId:43,expiresAt:now/1000+500});war.evaluateAlerts();assert.equal(tones,1);
war.current.settings.chainAlert=true;war.current.runtime.panelStats.chain={current:60,secondsLeft:45};war.evaluateAlerts();assert.equal(tones,2,'Chain warning still sounds with retals muted');
war.current.runtime.snapshot.retals.push({attackId:'c',attackerId:44,expiresAt:now/1000+500});war.evaluateAlerts();assert.equal(tones,2,'Muted retals must not retrigger an existing chain sound');
war.current.settings.retalAlerts=false;assert.equal(war.visibleRetals().length,0);war.current.settings.retalAlerts=true;
war.current.settings.retalSnoozedUntil=now+43200000;assert.equal(war.visibleRetals().length,0);
war.current.settings.retalSnoozedUntil=now-1;assert.equal(war.visibleRetals().length,3);
war.dismissedRetalMap['user:42']=now/1000+100;assert.equal(war.visibleRetals().length,2);now+=101000;assert.equal(war.visibleRetals().length,3,'Per-player snooze checks deadlines, not truthiness');
for(const file of ['src/dashboard/dashboard.js','src/modules/adhd.js','src/modules/target-list.js'])assert.match(read(file),/Snooze 12h/);
assert.match(source,/data-war-retal-pref/);assert.match(source,/label:`Snooze/);
console.log('Alert controls: durable company/onboarding snoozes, 12h options, retal enable/mute/expiry, independent chain sound passed.');

// Exercise the actual serial settings writer: retal-only changes must never reset keys,
// global sounds, or the other combat settings, even when two clicks overlap.
const serviceSource=read('src/background/war-service.js'), saved=new Map();
const settingsContext=vm.createContext({Date:Clock,Number,Math,String,Promise,settingsQueue:Promise.resolve(),KEYS:{settings:'settings',acceptedTerms:'terms'},SLINK:{core:{storage:{get:async(k,f)=>saved.get(k)??f,set:async(k,v)=>saved.set(k,structuredClone(v))}}},publicStatus:async()=>saved.get('settings')});
for(const name of ['defaults','settings','saveSettings'])vm.runInContext(extract(name,serviceSource,2),settingsContext);
saved.set('settings',{...settingsContext.defaults(),tornKey:'fixture-key',alertSound:true,minFF:2});
await Promise.all([settingsContext.saveSettings({retalAlerts:false}),settingsContext.saveSettings({retalSound:false,retalSnoozedUntil:now+43200000})]);
assert.equal(saved.get('settings').retalAlerts,false);assert.equal(saved.get('settings').retalSound,false);assert.equal(saved.get('settings').retalSnoozedUntil,now+43200000);
assert.equal(saved.get('settings').tornKey,'fixture-key');assert.equal(saved.get('settings').alertSound,true);assert.equal(saved.get('settings').minFF,2);
await settingsContext.saveSettings({retalSnoozedUntil:0});assert.equal(saved.get('settings').retalSnoozedUntil,0);
console.log('War retal-only concurrent writes preserve other settings and resume correctly.');
