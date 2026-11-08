// Find deck detail links + check /decks/new + URL search params on /cards
const { launch, shot, saveJSON } = require('./lib');

(async () => {
  const { browser, page } = await launch();

  // 1. deck detail links
  await page.goto('https://riftatlas.com/decks', { waitUntil: 'domcontentloaded', timeout: 60000 });
  try { await page.waitForLoadState('networkidle', { timeout: 30000 }); } catch {}
  await page.waitForTimeout(4000);
  const links = await page.evaluate(() => [...document.querySelectorAll('a')].map((a) => ({ href: a.getAttribute('href'), text: (a.innerText || '').trim().slice(0, 50) })).filter((l) => l.href && (l.href.includes('/deck') || /riven|kenny|seraphine|mordekaiser/i.test(l.text))).slice(0, 25));
  console.log('--- deck links ---');
  console.log(JSON.stringify(links, null, 1));

  // 2. /decks/new
  await page.goto('https://riftatlas.com/decks/new', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(4000);
  await shot(page, '20-decks-new');
  const txt = await page.evaluate(() => document.body.innerText.slice(0, 1200));
  console.log('--- /decks/new text ---');
  console.log(txt);

  // 3. /cards search param check
  await page.goto('https://riftatlas.com/cards?q=Ahri', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(4000);
  const ld = await page.evaluate(() => { const s = document.querySelector('script[type="application/ld+json"]'); return s ? s.textContent.slice(0, 400) : null; });
  console.log('--- /cards?q=Ahri ld ---');
  console.log(ld);

  await browser.close();
})().catch((e) => { console.error('FATAL', e); process.exit(1); });
