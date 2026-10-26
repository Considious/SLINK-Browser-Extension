import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';

const code = fs.readFileSync(new URL('../src/core/company.js', import.meta.url), 'utf8');
const namespaces = { core:{} };
const sandbox = {
  console,
  globalThis:null,
  SLINK_EXTENSION:{
    define(namespace, name, value) {
      namespaces[namespace] ||= {};
      namespaces[namespace][name] = value;
      this[namespace] ||= {};
      this[namespace][name] = value;
    },
    core:namespaces.core
  }
};
sandbox.globalThis = sandbox;
vm.runInNewContext(code, sandbox);
const company = sandbox.SLINK_EXTENSION.core.company;

assert.equal(company.addictionPenalty({ effectiveness:{ addiction:-12 } }), 12);
assert.equal(company.addictionPenalty({ effectiveness:{ addiction:4 } }), 0);
assert.equal(company.addictionPenalty({}), null);

const snapshot = company.normalizeSnapshot(
  {
    job:{ type:'company', id:44, type_id:6, name:'Test Company', rating:10, position:'Director', days_in_company:90 },
    jobpoints:{ companies:[{ company:{ id:6, name:'Gun Shop' }, points:321 },{ company:{id:44,name:'Unrelated company type'},points:999 }] }
  },
  {
    profile:{ id:44, name:'Test Company', rating:10, director:{ id:7, name:'Owner' } },
    employees:[
      { id:7, name:'Owner', effectiveness:{ addiction:-2, working_stats:45, total:80 }, stats:{ manual_labor:100 } },
      { id:8, name:'Needs Rehab', effectiveness:{ addiction:-15, working_stats:20, total:60 }, stats:{ manual_labor:50 } }
    ]
  },
  7,
  1000
);
assert.equal(snapshot.director, true);
assert.equal(snapshot.company.jobPoints, 321);
assert.equal(snapshot.self.name, 'Owner');
assert.equal(snapshot.company.typeId,6,'Job points are keyed by CompanyTypeId, not the specific company ID');
const otherCompany=company.normalizeSnapshot({job:{type:'company',id:55,type_id:6},jobpoints:{companies:[{company:{id:6,name:'Gun Shop'},points:321}]}},{},7);
assert.equal(otherCompany.company.jobPoints,321,'Moving to another company of the same type must retain the same point balance');
assert.equal(company.normalizeSnapshot({job:{type:'company',id:44,type_id:7},jobpoints:{companies:[{company:{id:6},points:321}]}},{},7).company.jobPoints,null,'An unrelated company type must not supply the current point balance');

const alerts = company.buildAlerts(snapshot, { addictionThreshold:2, directorThreshold:10 });
assert.deepEqual(Array.from(alerts, alert => alert.id), ['company:addiction:self','company:addiction:8']);
assert.equal(alerts[1].reminder, 'Your addiction penalty is currently -15. Please rehab as soon as possible.');

const employeeSnapshot = company.normalizeSnapshot({}, { profile:{ director:{ id:7 } }, employees:[] }, 8);
assert.equal(employeeSnapshot.director, false);
assert.equal(company.buildAlerts(employeeSnapshot, {}).length, 0);
assert.equal(company.buildAlerts({...snapshot,self:null}, {directorThreshold:10})[0]?.id,'company:addiction:8','A missing director roster row must not suppress other employee alerts');

const ranked = company.rankTrainCandidates(snapshot.employees);
assert.equal(ranked[0].id, 8);
assert.equal(company.normalizeSettings({ addictionThreshold:0, directorThreshold:999, refreshMinutes:1 }).addictionThreshold, 1);
assert.equal(company.normalizeSettings({ addictionThreshold:0, directorThreshold:999, refreshMinutes:1 }).directorThreshold, 100);
assert.equal(company.normalizeSettings({ addictionThreshold:0, directorThreshold:999, refreshMinutes:1 }).refreshMinutes, 5);

console.log('company tests passed');
