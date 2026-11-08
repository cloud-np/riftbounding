// Mobile (390x844) captures: lobby + landing
const { launch, shot, saveJSON } = require('./lib');

(async () => {
  const { browser, page } = await launch({ viewport: { width: 390, height: 844 } });

  await page.goto('https://play.riftatlas.com/', { waitUntil: 'domcontentloaded', timeout: 60000 });
  try { await page.waitForLoadState('networkidle', { timeout: 30000 }); } catch {}
  await page.waitForTimeout(4000);
  await shot(page, '30-mobile-lobby', true);
  await shot(page, '30-mobile-lobby-viewport');
  const nav = await page.evaluate(() => ({ w: innerWidth, h: innerHeight, scrollH: document.body.scrollHeight }));
  console.log('mobile lobby:', JSON.stringify(nav));

  await page.goto('https://riftatlas.com/play', { waitUntil: 'domcontentloaded', timeout: 60000 });
  try { await page.waitForLoadState('networkidle', { timeout: 30000 }); } catch {}
  await page.waitForTimeout(4000);
  await shot(page, '31-mobile-landing', true);
  await shot(page, '31-mobile-landing-viewport');
  console.log('mobile landing done');

  await browser.close();
})().catch((e) => { console.error('FATAL', e); process.exit(1); });
