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

assert(market.includes("return document.visibilityState !== 'hidden';"), 'Market DOM formatting must not depend on document.hasFocus() in PDA/WebView or Torn SPA transitions.');
assert(market.includes("const marketDomTestAllowed = SLINK.core.permissions.hasScope(context.permissions, 'admin.*');"), 'Market DOM Test must derive visibility from admin.*.');
assert(market.includes("if (marketDomTestAllowed) marketActions.push"), 'Market DOM Test must only be added for administrators.');
assert(market.includes("data-tdd-market-dom-test"), 'Market DOM Test must mark a real production listing.');
assert(market.includes("[data-tdd-market-dom-test=\"bazaar\"]") && market.includes("[data-tdd-market-dom-test=\"item-market\"]"), 'Forced test listings must enter the production quick-buy selector path.');
assert(market.includes("if (!event.isTrusted"), 'SLINK Buy must remain user-initiated.');
assert(market.includes("spec.native.click();"), 'SLINK Buy must delegate to Torn native controls.');

console.log('ADHD market DOM flow, admin-only diagnostic, and focus-independent SPA wiring are verified.');
