// Probe /decks, /decks/mine, public deck detail, possible edit routes. Read-only.
const { launch, shot } = require('../lib');

(async () => {
  const { browser, page, log } = await launch();
  const urls = [
    'https://riftatlas.com/decks',
    'https://riftatlas.com/decks/mine',
    'https://riftatlas.com/decks/mine/test',
    'https://riftatlas.com/decks/new?savedDeckId=test',
    'https://riftatlas.com/decks/community/jh799bw9vxekd68b9vf6hz0zh18fwjc3',
  ];
  for (const u of urls) {
    log.network.length = 0;
    await page.goto(u, { waitUntil: 'domcontentloaded', timeout: 90000 });
    try { await page.waitForLoadState('networkidle', { timeout: 30000 }); } catch {}
    await page.waitForTimeout(2500);
    const info = await page.evaluate(() => ({
      title: document.title,
      h: [...document.querySelectorAll('h1,h2,h3')].map((e) => (e.innerText || '').replace(/\s+/g, ' ').slice(0, 80)).slice(0, 10),
      text: (document.body.innerText || '').replace(/\s+/g, ' ').slice(0, 900),
      links: [...document.querySelectorAll('a')].map((a) => a.getAttribute('href')).filter((h) => h && /deck/.test(h)).slice(0, 25),
      buttons: [...document.querySelectorAll('button')].map((b) => (b.innerText || b.getAttribute('aria-label') || '').replace(/\s+/g, ' ').slice(0, 50)).filter(Boolean).slice(0, 40),
      testids: [...new Set([...document.querySelectorAll('[data-testid]')].map((e) => e.getAttribute('data-testid')))].slice(0, 60),
    }));
    const chunks = [...new Set(log.network.filter((r) => r.kind === 'req').map((r) => r.url).filter((x) => /_next\/static.*\.js/.test(x)))].map((x) => x.split('/').pop());
    console.log('===', u, '\n', JSON.stringify(info).slice(0, 1800), '\nCHUNKS extra:', chunks.filter((c) => !require('fs').existsSync(require('path').resolve(__dirname, '../../raw/decks/' + c))).join(', '));
    const name = u.replace('https://riftatlas.com', '').replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '') || 'decks';
    await shot(page, 'decks/route-' + name.slice(0, 50));
  }
  await browser.close();
})().catch((e) => { console.error('FATAL', e.stack?.slice(0, 1000)); process.exit(1); });
