// Sealed pack opening reveal capture
const { launch, shot, saveJSON } = require('./lib');

(async () => {
  const { browser, page } = await launch();
  await page.goto('https://riftatlas.com/sealed?format=mix-unl3-ven3&seed=s.kq2drp', { waitUntil: 'domcontentloaded', timeout: 60000 });
  try { await page.waitForLoadState('networkidle', { timeout: 30000 }); } catch {}
  await page.waitForTimeout(5000);
  await shot(page, '48-sealed-products');

  // find "Open" clickables
  const info = await page.evaluate(() => [...document.querySelectorAll('button, a')].filter((b) => /open/i.test(b.innerText || '') || /open/i.test(b.getAttribute('aria-label') || '')).slice(0, 10).map((b) => ({ tag: b.tagName, t: (b.innerText || '').trim().slice(0, 40), aria: b.getAttribute('aria-label') })));
  console.log('open clickables:', JSON.stringify(info));

  const first = page.getByText(/^Open$/).first();
  console.log('getByText open count:', await page.getByText(/^Open$/).count());
  await first.click();
  await page.waitForTimeout(3500);
  await shot(page, '48b-sealed-pack-opening');
  const txt = await page.evaluate(() => document.body.innerText.slice(0, 1200));
  console.log('after open txt:', txt.slice(0, 800));
  await page.waitForTimeout(3500);
  await shot(page, '48c-sealed-pack-revealed');
  const txt2 = await page.evaluate(() => document.body.innerText.slice(0, 1500));
  console.log('reveal txt:', txt2.slice(0, 900));

  // try clicking a card in the reveal (flip?)
  await page.mouse.click(960, 540);
  await page.waitForTimeout(1500);
  await shot(page, '48d-sealed-reveal-click');

  // look for actions after opening (Play / Save / Export)
  const actions = await page.evaluate(() => [...document.querySelectorAll('button, a')].map((b) => (b.innerText || '').trim()).filter((t) => /play|save|export|simulator|deck/i.test(t)).slice(0, 15));
  console.log('post-open actions:', JSON.stringify(actions));
  await browser.close();
})().catch((e) => { console.error('FATAL', e); process.exit(1); });
