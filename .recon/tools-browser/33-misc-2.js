// Remaining public pages: customize, sealed, decks/new; plus game-history tooltip state
const { launch, shot, saveJSON } = require('./lib');

(async () => {
  const { browser, page } = await launch();

  await page.goto('https://play.riftatlas.com/', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(3000);
  const gh = await page.evaluate(() => { const b = document.querySelector('[data-hub-history-action]'); return b ? { disabled: b.disabled, title: b.title } : null; });
  console.log('game history btn:', JSON.stringify(gh));

  await page.goto('https://play.riftatlas.com/customize', { waitUntil: 'domcontentloaded', timeout: 60000 });
  try { await page.waitForLoadState('networkidle', { timeout: 30000 }); } catch {}
  await page.waitForTimeout(4000);
  await shot(page, '38-customize', true);
  const cust = await page.evaluate(() => ({ url: location.href, title: document.title, txt: document.body.innerText.slice(0, 800) }));
  console.log('CUSTOMIZE:', JSON.stringify(cust).slice(0, 900));

  await page.goto('https://riftatlas.com/sealed', { waitUntil: 'domcontentloaded', timeout: 60000 });
  try { await page.waitForLoadState('networkidle', { timeout: 30000 }); } catch {}
  await page.waitForTimeout(4000);
  await shot(page, '39-sealed', true);
  const sealed = await page.evaluate(() => ({ url: location.href, txt: document.body.innerText.slice(500, 2000) }));
  console.log('SEALED:', JSON.stringify(sealed).slice(0, 1500));

  await page.goto('https://riftatlas.com/decks/new', { waitUntil: 'domcontentloaded', timeout: 60000 });
  try { await page.waitForLoadState('networkidle', { timeout: 30000 }); } catch {}
  await page.waitForTimeout(4000);
  await shot(page, '40-decks-new');
  const nd = await page.evaluate(() => ({ url: location.href, txt: document.body.innerText.slice(400, 1400), dialog: !!document.querySelector('dialog[open], [role=dialog]') }));
  console.log('DECKS/NEW:', JSON.stringify(nd).slice(0, 1300));

  await browser.close();
})().catch((e) => { console.error('FATAL', e); process.exit(1); });
