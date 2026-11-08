const assert=require('node:assert/strict'),path=require('node:path');
const {chromium}=require(process.env.SLINK_PLAYWRIGHT_MODULE||'playwright');
const script='../src/content/casino-guide.js';
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
  'casino.php':'<ul class="games-list"><li><a href="/page.php?sid=highlow">High-Low</a></li><li><a href="/page.php?sid=blackjack">Blackjack</a></li><li><a href="/page.php?sid=slots">Slots</a><button>Game help</button></li><li><a href="/page.php?sid=casinoSettings">Casino settings</a></li></ul><button id="game">Casino tokens</button>',
  'page.php?sid=highlow':'<div class="actions-wrap"><button id="game">Higher</button></div>',
  'page.php?sid=blackjack':'<div class="player-cards"></div><button id="game">Hit</button>'
};
(async()=>{
 const browser=await chromium.launch({channel:process.env.SLINK_TEST_BROWSER||'msedge'});
 try{for(const width of [390,1100]){
   const page=await browser.newPage({viewport:{width,height:800}});
   const requests=[];
   await page.route('https://www.torn.com/**',r=>{const file=r.request().url().split('www.torn.com/')[1];requests.push(file);return r.fulfill({contentType:'text/html; charset=utf-8',body:'<main id="mainContainer">'+pages[file]+'</main><script>window.actions=0;document.querySelector("#game").onclick=()=>window.actions++</script>'});});
   const open=async file=>{await page.goto('https://www.torn.com/'+file);await page.addScriptTag({path:path.join(__dirname,script)});};
   await open('page.php?sid=highlow');await page.getByText('SLINK High-Low odds').click();
   await page.getByLabel('Visible card').selectOption('A');await page.getByText('Higher 0.0% · Lower 94.1% · Equal 5.9%.').waitFor();
   assert.equal(await page.evaluate(()=>window.actions),0);
   await open('page.php?sid=blackjack');await page.getByText('SLINK Blackjack advice').click();
   await page.getByLabel('Dealer upcard').selectOption('6');await page.getByLabel('Your cards').fill('5, 6');await page.getByLabel('Double is available').check();
   await page.getByText('Total 11 · Suggested: Double.').waitFor();assert.equal(await page.evaluate(()=>window.actions),0);
   await open('casino.php');await page.getByText('Show or hide casino games').click();await page.getByLabel('High-Low',{exact:true}).uncheck();
   await page.getByRole('link',{name:'High-Low'}).waitFor({state:'hidden'});await page.getByRole('link',{name:'Blackjack'}).waitFor();
   assert.equal(await page.getByLabel('Casino settings',{exact:true}).count(),0);
   await page.getByLabel('Slots',{exact:true}).uncheck();await page.getByRole('button',{name:'Game help'}).waitFor();
   await page.getByRole('link',{name:'Casino settings'}).waitFor();
   await open('casino.php');await page.getByRole('link',{name:'High-Low'}).waitFor({state:'hidden'});await page.getByText('Show or hide casino games').click();
   await page.getByRole('button',{name:'Show all games'}).click();await page.getByRole('link',{name:'High-Low'}).waitFor();
   await page.getByRole('link',{name:'Slots'}).waitFor();
   assert.equal(await page.evaluate(()=>window.actions),0);
   assert.deepEqual(requests,['page.php?sid=highlow','page.php?sid=blackjack','casino.php','casino.php']);
   await page.close();
 }}finally{await browser.close();}
 console.log('Casino helpers: odds, blackjack, reversible visibility, and no game actions or extra requests passed');
})().catch(e=>{console.error(e);process.exitCode=1;});
