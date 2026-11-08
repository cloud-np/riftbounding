// Mobile full-board preview capture
const { launch, shot, saveJSON } = require('./lib');

(async () => {
  const { browser, page } = await launch({ viewport: { width: 390, height: 844 } });
  await page.goto('https://play.riftatlas.com/customize', { waitUntil: 'domcontentloaded', timeout: 60000 });
  try { await page.waitForLoadState('networkidle', { timeout: 30000 }); } catch {}
  await page.waitForTimeout(3500);
  const vfb = page.getByRole('button', { name: /view full board/i }).first();
  console.log('vfb count:', await vfb.count());
  await vfb.click().catch((e) => console.log('click err', e.message.slice(0, 80)));
  await page.waitForTimeout(5000);
  await shot(page, '60-mobile-full-board');
  const t = await page.evaluate(() => ({ w: innerWidth, txt: document.body.innerText.slice(0, 600) }));
  console.log(JSON.stringify(t).slice(0, 700));
  await browser.close();
})().catch((e) => { console.error('FATAL', e); process.exit(1); });
