import assert from 'node:assert/strict';
import fs from 'node:fs';

const market = fs.readFileSync(new URL('../src/modules/market.js', import.meta.url), 'utf8');
const marketCore = fs.readFileSync(new URL('../src/core/market.js', import.meta.url), 'utf8');
const war = fs.readFileSync(new URL('../src/modules/war.js', import.meta.url), 'utf8');

for (const functionName of [
  'formatBazaarOneDollarListings',
  'formatItemMarketPurchaseOpportunities',
  'fillBazaarPurchaseMaximum',
  'fillItemMarketPurchaseMaximum',
  'syncHighlightedQuickPurchaseControls',
  'handleHighlightedQuickPurchaseClick'
]) {
  assert(market.includes(`function ${functionName}`), `Missing ADHD Dashboard purchase function: ${functionName}`);
}
for (const marker of [
  'data-tdd-bazaar-targeted',
  'data-tdd-bazaar-shop-profit',
  'data-tdd-item-market-one-dollar',
  'data-tdd-item-market-shop-profit',
  'data-tdd-quick-buy',
  'tdd-quick-buy-layer'
]) {
  assert(market.includes(marker), `Missing ADHD Dashboard DOM marker: ${marker}`);
}
assert(!market.includes('function formatPurchasePage'), 'The duplicate generalized highlighter must stay removed');
assert(!market.includes('data-slink-market-highlight'), 'The duplicate SLINK highlight attributes must stay removed');
assert(marketCore.includes("url.searchParams.set('highlight', '1')"), 'Bazaar alert links must use the ADHD highlight contract');
assert(!war.includes('slink-armory-request-cell'), 'SLINK must not add request cells to Torn Armory rows');
assert(!war.includes('queueArmoryEnhancement'), 'SLINK must not restructure Torn Armory rows');
assert(war.includes('war.armory.request'), 'Armory request handling must remain available');
console.log('Original ADHD market highlighting/BUY flow is wired and Torn Armory rows are untouched.');
