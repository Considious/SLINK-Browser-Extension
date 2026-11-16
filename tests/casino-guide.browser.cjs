const assert=require('node:assert/strict'),path=require('node:path');
const {chromium}=require(process.env.SLINK_PLAYWRIGHT_MODULE||'playwright');
const script=process.env.SLINK_CASINO_FIXTURE_SCRIPT||path.join(__dirname,'../src/content/casino-guide.js');
require(script);
const {highLow,blackjack}=globalThis.SLINK_CASINO_GUIDE;
assert.deepEqual(highLow('A'),{higher:0,lower:48,equal:3,total:51});
assert.deepEqual(highLow('2',['3','2']),{higher:47,lower:0,equal:2,total:49});
assert.equal(highLow('2',['2','2','2','2']),null);
assert.equal(blackjack(['A','K'],'7').done,'Blackjack');
assert.equal(blackjack(['A','K'],'7',{splitHand:true}).done,undefined);
assert.equal(blackjack(['2','2','2','3','4','5'],'7').done,'Six-card Charlie');
assert.equal(blackjack(['K','8','7'],'7').done,'Bust');
assert.equal(blackjack(['5','6'],'6',{double:true}).moves[0][0],'Double');
assert.equal(blackjack(['K','8'],'6').moves[0][0],'Stand');
assert.equal(blackjack(['4','4'],'7').pair,true);
const pages={
  'casino.php':'<ul class="games-list m-top10"><li class="left"><a href="page.php?sid=highlow">High-Low</a></li><li class="left t-last"><a href="page.php?sid=holdem"><span class="title">Poker</span></a></li><li class="left last"><a href="page.php?sid=blackjack">Blackjack</a></li><li class="clear"></li></ul><button id="game">Casino tokens</button><button>Game help</button><a href="/page.php?sid=casinoSettings">Casino settings</a>',
  'page.php?sid=highlow':'<div class="actions-wrap"><button id="game">Higher</button></div>',
  'page.php?sid=blackjack':'<div class="player-cards"></div><button id="game">Hit</button>'
};
(async()=>{
 const browser=await chromium.launch({channel:process.env.SLINK_TEST_BROWSER||'msedge'});
 try{for(const width of [390,1100]){
   const page=await browser.newPage({viewport:{width,height:800}});
   const requests=[];
   await page.route('https://www.torn.com/**',r=>{const file=r.request().url().split('www.torn.com/')[1];requests.push(file);return r.fulfill({contentType:'text/html; charset=utf-8',body:'<main id="mainContainer">'+pages[file]+'</main><script>window.actions=0;document.querySelector("#game").onclick=()=>window.actions++</script>'});});
   const open=async file=>{await page.goto('https://www.torn.com/'+file);await page.addScriptTag({path:script});};
   await open('page.php?sid=highlow');await page.getByText('SLINK High-Low odds').click();
   await page.getByLabel('Visible card').selectOption('A');await page.getByText('Higher 0.0% · Lower 94.1% · Equal 5.9%.').waitFor();
   assert.equal(await page.evaluate(()=>window.actions),0);
   await open('page.php?sid=blackjack');await page.getByText('SLINK Blackjack advice').click();
   await page.getByLabel('Dealer upcard').selectOption('6');await page.getByLabel('Your cards').fill('5, 6');await page.getByLabel('Double is available').check();
   await page.getByText('Total 11 · Suggested: Double.').waitFor();assert.equal(await page.evaluate(()=>window.actions),0);
   await open('casino.php');await page.getByText('Show or hide casino games').click();
   const mainSwitch=page.getByRole('switch',{name:'High-Low'});
   await mainSwitch.focus();
   await mainSwitch.press('Space');
   assert.equal(await mainSwitch.evaluate(input=>document.activeElement===input),true);
   await page.getByRole('link',{name:'High-Low'}).waitFor({state:'hidden'});
   await page.getByRole('switch',{name:'Poker'}).uncheck();
   await page.getByRole('link',{name:'Poker'}).waitFor({state:'hidden'});
   assert.equal(await page.locator('.games-list > li[data-slink-hidden-casino-game]').count(),2);
   assert.equal(await page.locator('.games-list').evaluate(list=>getComputedStyle(list).columnGap),'8px');
   await page.getByRole('link',{name:'Blackjack'}).waitFor();
   await page.getByRole('button',{name:'Game help'}).waitFor();
   await page.getByRole('link',{name:'Casino settings'}).waitFor();
   await open('casino.php');await page.getByRole('link',{name:'Poker'}).waitFor({state:'hidden'});
   await page.getByText('Show or hide casino games').click();
   await page.getByRole('switch',{name:'Poker'}).check();
   await page.getByRole('link',{name:'Poker'}).waitFor();
   const bounds=await page.locator('.games-list > li:not([data-slink-hidden-casino-game],.clear)').evaluateAll(tiles=>tiles.map(tile=>{const r=tile.getBoundingClientRect();return {left:r.left,top:r.top,right:r.right,bottom:r.bottom};}));
   assert.equal(bounds.length,2);
   const [first,second]=bounds;
   assert.ok(second.left>=first.right+7||second.top>=first.bottom+7,'Visible tiles must have room between them.');
   await page.getByRole('button',{name:'Show all games'}).click();
   await page.getByRole('link',{name:'High-Low'}).waitFor();
   assert.equal(await page.locator('.games-list[data-slink-casino-compact]').count(),0);
   assert.equal(await page.evaluate(()=>window.actions),0);
   assert.deepEqual(requests,['page.php?sid=highlow','page.php?sid=blackjack','casino.php','casino.php']);
   await page.close();
 }}finally{await browser.close();}
 console.log('Casino helpers: odds, blackjack, reversible visibility, and no game actions or extra requests passed');
})().catch(e=>{console.error(e);process.exitCode=1;});
