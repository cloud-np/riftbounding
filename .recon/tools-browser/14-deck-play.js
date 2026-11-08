// Click a community deck's "Play" button and follow the flow
const { launch, shot, saveJSON } = require('./lib');

(async () => {
  const { browser, page, log } = await launch();
  await page.goto('https://riftatlas.com/decks', { waitUntil: 'domcontentloaded', timeout: 60000 });
  try { await page.waitForLoadState('networkidle', { timeout: 30000 }); } catch {}
  await page.waitForTimeout(4000);

  const playBtn = page.locator('button:has-text("Play")').first();
  console.log('button count:', await playBtn.count());
  await playBtn.click();
  await page.waitForTimeout(6000);
  console.log('after click url:', page.url());
  await shot(page, '14-after-deck-play-click');

  // Check for new tab
  const pages = page.context().pages();
  console.log('open pages:', pages.map((p) => p.url()));

  const target = pages[pages.length - 1];
  if (target.url().includes('play.riftatlas')) {
    await target.waitForLoadState('domcontentloaded');
    await target.waitForTimeout(5000);
    await target.screenshot({ path: require('path').resolve(__dirname, '..', 'screens', '14-play-with-deck.png') });
    const store = await target.evaluate(() => { const o = {}; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); o[k] = localStorage.getItem(k).slice(0, 500); } return o; });
    console.log('play page localStorage:', JSON.stringify(store, null, 1).slice(0, 3000));
  }

  saveJSON('14-deck-play-network', log.network.filter((n) => n.kind === 'req').map((n) => ({ m: n.method, u: n.url.slice(0, 200), t: n.type, post: n.post && n.post.slice(0, 300) })));
  await browser.close();
})().catch((e) => { console.error('FATAL', e); process.exit(1); });
