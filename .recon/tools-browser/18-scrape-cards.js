// Scrape card database from riftatlas.com/cards
const { launch, shot, saveJSON } = require('./lib');
const fs = require('fs');
const path = require('path');

(async () => {
  const { browser, page } = await launch();
  await page.goto('https://riftatlas.com/cards', { waitUntil: 'domcontentloaded', timeout: 60000 });
  try { await page.waitForLoadState('networkidle', { timeout: 40000 }); } catch {}
  await page.waitForTimeout(5000);

  // dump one card element to learn structure
  const oneCard = await page.evaluate(() => {
    const cand = [...document.querySelectorAll('a, article, li, div')].find((d) => /\b(OGN|UNL|VEN|SFD|RAD)-\d+/.test(d.innerText || '') && d.querySelector('img') && (d.innerText || '').length < 400);
    return cand ? cand.outerHTML.slice(0, 4000) : null;
  });
  if (oneCard) fs.writeFileSync(path.join(__dirname, '..', 'browser', '18-card-element.html'), oneCard);
  console.log('card element captured:', !!oneCard);

  // scrape all currently rendered cards
  const cards = await page.evaluate(() => {
    const out = [];
    const re = /([A-Z]{2,4})-(\d{3})(?:\/(\d{3}))?/;
    for (const el of document.querySelectorAll('a, article, li, div')) {
      const txt = el.innerText || '';
      if (!re.test(txt) || txt.length > 500) continue;
      // must contain an img (card art) and be leaf-ish
      const img = el.querySelector('img');
      if (!img) continue;
      const lines = txt.split('\n').map((s) => s.trim()).filter(Boolean);
      if (lines.length < 2 || lines.length > 12) continue;
      const m = txt.match(re);
      out.push({ lines, code: m ? m[0] : null });
    }
    // dedupe by code+lines
    const seen = new Set();
    return out.filter((c) => { const k = c.code + '|' + c.lines.join('|'); if (seen.has(k)) return false; seen.add(k); return true; });
  });
  console.log('cards scraped:', cards.length);
  console.log(JSON.stringify(cards.slice(0, 12), null, 1));
  saveJSON('18-cards-scraped', cards);

  await browser.close();
})().catch((e) => { console.error('FATAL', e); process.exit(1); });
