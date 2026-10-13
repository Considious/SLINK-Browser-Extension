import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';

const code = fs.readFileSync(new URL('../src/core/money-property.js', import.meta.url), 'utf8');
const sandbox = { console, globalThis:null, SLINK_EXTENSION:{ core:{}, define(namespace,name,value){ this[namespace] ||= {}; this[namespace][name] = value; } } };
sandbox.globalThis = sandbox;
vm.runInNewContext(code, sandbox);
const money = sandbox.SLINK_EXTENSION.core.moneyProperty;
const now = 1_800_000_000_000;
const status = money.buildStatus({
  user:{
    money:{ cash:2_000_000, faction:{ money:4_000_000 }, city_bank:{ amount:1_000_000, time_left:0 }, loan:{ amount:0 } },
    properties:[{ id:1, name:'Private Island', status:'rented', rented:{ days_left:2 }, upkeep_owed:1_500_000, lease_extension:{ status:'pending', period:30 } }],
    honors:[{ name:'Another honor' }],
    stocks:[{ id:1, shares:50 }]
  },
  tornStocks:{ stocks:[{ id:1, name:'Test Stock', acronym:'TST', current_price:1000, bonus:{ requirement:100, description:'$700,000 every 7 days', frequency:7 } }] }
}, { stockAlerts:{ '1:100':true } }, now);

assert.equal(status.money.availableCash, 6_000_000);
assert.equal(status.bank.matured, true);
assert.equal(status.currentProperty.upkeepOwed, 1_500_000);
assert.equal(status.stocks[0].incrementalCost, 50_000);
assert.equal(status.stocks[0].affordable, true);
assert.ok(status.stocks[0].weeklyRoi > 0);
const alerts = money.buildAlerts(status, { stockAlerts:{ '1:100':true }, upkeepThreshold:1_000_000 }, now);
assert.ok(alerts.some(alert => alert.id === 'money-property:bank-matured'));
assert.ok(alerts.some(alert => alert.id === 'money-property:rental'));
assert.ok(alerts.some(alert => alert.id === 'money-property:upkeep'));
assert.ok(alerts.some(alert => alert.id === 'money-property:lease-extension'));
assert.ok(alerts.some(alert => alert.id === 'money-property:loan-shark'));
assert.ok(alerts.some(alert => alert.id === 'money-property:stock:1:100'));
console.log('money and property tests passed');
