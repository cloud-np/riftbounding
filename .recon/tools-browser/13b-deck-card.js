// Find deck card structure + Play link on riftatlas.com/decks
const { launch, shot, saveJSON, dumpDOM } = require('./lib');

(async () => {
  const { browser, page, log } = await launch();
  await page.goto('https://riftatlas.com/decks', { waitUntil: 'domcontentloaded', timeout: 60000 });
  try { await page.waitForLoadState('networkidle', { timeout: 30000 }); } catch {}
  await page.waitForTimeout(4000);

  // Find links/buttons containing "Play"
  const playLinks = await page.evaluate(() => {
    return [...document.querySelectorAll('a, button')]
      .filter((el) => /^play$/i.test((el.innerText || '').trim()) || (el.innerText || '').toLowerCase().includes('play'))
      .slice(0, 10)
      .map((el) => ({ tag: el.tagName.toLowerCase(), text: (el.innerText || '').trim().slice(0, 40), href: el.getAttribute('href'), cls: String(el.className).slice(0, 120), onclick: el.getAttribute('onclick') }));
  });
  console.log('--- play links ---');
  console.log(JSON.stringify(playLinks, null, 1));

  // find the first deck card container: element containing text "clones"
  const deckCardHTML = await page.evaluate(() => {
    const all = [...document.querySelectorAll('article, li, div')];
    const card = all.find((d) => /clones/.test(d.innerText || '') && d.querySelectorAll('*').length < 200 && (d.innerText || '').length < 600);
    return card ? card.outerHTML.slice(0, 15000) : null;
  });
  if (deckCardHTML) require('fs').writeFileSync(require('path').resolve(__dirname, '..', 'browser', '13-deck-card.html'), deckCardHTML);
  console.log('deck card captured:', !!deckCardHTML);

  // Click the first "Play" and see where it goes
  const first = page.locator('a:has-text("Play"), button:has-text("Play")').first();
  if (await first.count()) {
    const href = await first.getAttribute('href').catch(() => null);
    console.log('first play href:', href);
    if (href) {
      await page.goto(new URL(href, 'https://riftatlas.com').href, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(4000);
      console.log('landed at:', page.url());
      await shot(page, '14-deck-play-target');
    }
  }
  await browser.close();
})().catch((e) => { console.error('FATAL', e); process.exit(1); });
