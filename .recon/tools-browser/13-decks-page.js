// Explore riftatlas.com/decks to find public decks + export format
const { launch, shot, saveJSON } = require('./lib');

(async () => {
  const { browser, page, log } = await launch();
  await page.goto('https://riftatlas.com/decks', { waitUntil: 'domcontentloaded', timeout: 60000 });
  try { await page.waitForLoadState('networkidle', { timeout: 30000 }); } catch {}
  await page.waitForTimeout(4000);
  await shot(page, '13-decks-page');

  const text = await page.evaluate(() => document.body.innerText.slice(0, 6000));
  console.log('--- decks page text ---');
  console.log(text);

  // find deck links
  const links = await page.evaluate(() => [...document.querySelectorAll('a[href*="deck"]')].map((a) => ({ href: a.getAttribute('href'), text: (a.innerText || '').trim().slice(0, 60) })).filter((l, i, arr) => arr.findIndex((x) => x.href === l.href) === i).slice(0, 40));
  console.log('--- deck links ---');
  console.log(JSON.stringify(links, null, 1));

  // API calls observed
  const api = log.network.filter((n) => n.kind === 'req' && (n.url.includes('/api/') || n.type === 'fetch' || n.type === 'xhr'));
  console.log('--- api/fetch requests ---');
  console.log(api.map((n) => `${n.method} ${n.url.slice(0, 160)}`).join('\n'));

  saveJSON('13-decks-network', log.network.filter((n) => n.kind === 'req'));
  await browser.close();
})().catch((e) => { console.error('FATAL', e); process.exit(1); });
