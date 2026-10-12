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
    job:{ company_id:44, company_name:'Test Company', company_rating:10, position:'Director', days_in_company:90 },
    jobpoints:{ companies:[{ company:{ id:44, name:'Test Company' }, points:321 }] }
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

const alerts = company.buildAlerts(snapshot, { addictionThreshold:2, directorThreshold:10 });
assert.deepEqual(Array.from(alerts, alert => alert.id), ['company:addiction:self','company:addiction:8']);
assert.equal(alerts[1].reminder, 'Your addiction penalty is currently -15. Please rehab as soon as possible.');

const employeeSnapshot = company.normalizeSnapshot({}, { profile:{ director:{ id:7 } }, employees:[] }, 8);
assert.equal(employeeSnapshot.director, false);
assert.equal(company.buildAlerts(employeeSnapshot, {}).length, 0);

const ranked = company.rankTrainCandidates(snapshot.employees);
assert.equal(ranked[0].id, 8);
assert.equal(company.normalizeSettings({ addictionThreshold:0, directorThreshold:999, refreshMinutes:1 }).addictionThreshold, 1);
assert.equal(company.normalizeSettings({ addictionThreshold:0, directorThreshold:999, refreshMinutes:1 }).directorThreshold, 100);
assert.equal(company.normalizeSettings({ addictionThreshold:0, directorThreshold:999, refreshMinutes:1 }).refreshMinutes, 5);

console.log('company tests passed');
