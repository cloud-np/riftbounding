// Find card data API on riftatlas.com/cards
const { launch, shot, saveJSON } = require('./lib');

(async () => {
  const { browser, page, log } = await launch();
  await page.goto('https://riftatlas.com/cards', { waitUntil: 'domcontentloaded', timeout: 60000 });
  try { await page.waitForLoadState('networkidle', { timeout: 40000 }); } catch {}
  await page.waitForTimeout(5000);
  await shot(page, '17-cards-page');

  // look for JSON responses with card data
  const jsonRes = log.network.filter((n) => n.kind === 'res' && (n.ct || '').includes('json'));
  console.log('--- json responses ---');
  jsonRes.slice(0, 30).forEach((r) => console.log(r.status, r.url.slice(0, 200)));

  const fetches = log.network.filter((n) => n.kind === 'req' && (n.type === 'fetch' || n.type === 'xhr'));
  console.log('--- fetch/xhr ---');
  fetches.slice(0, 40).forEach((r) => console.log(r.method, r.url.slice(0, 200)));

  saveJSON('17-cards-network', log.network.filter((n) => n.kind === 'req'));
  await browser.close();
})().catch((e) => { console.error('FATAL', e); process.exit(1); });
