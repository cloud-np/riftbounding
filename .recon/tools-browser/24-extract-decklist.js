// Extract full decklist text from a community deck page
const { launch } = require('./lib');
const fs = require('fs');
const path = require('path');

(async () => {
  const { browser, page } = await launch();
  await page.goto('https://riftatlas.com/decks/community/jh799bw9vxekd68b9vf6hz0zh18fwjc3', { waitUntil: 'domcontentloaded', timeout: 60000 });
  try { await page.waitForLoadState('networkidle', { timeout: 30000 }); } catch {}
  await page.waitForTimeout(5000);

  const deck = await page.evaluate(() => {
    const sections = ['LEGEND', 'CHAMPION', 'MAIN DECK', 'BATTLEFIELDS', 'RUNES', 'SIDEBOARD'];
    const out = {};
    // find all elements with class containing 'uppercase' whose text matches a section
    const all = [...document.querySelectorAll('h2, h3, div, span')];
    for (const sec of sections) {
      const header = all.find((e) => (e.innerText || '').trim().toUpperCase() === sec && e.children.length < 3);
      if (!header) continue;
      // walk up to container that holds the card rows, then grab rows via title attributes
      let container = header.closest('section') || header.parentElement?.parentElement?.parentElement;
      const rows = container ? [...container.querySelectorAll('[title]')].map((r) => {
        const t = r.getAttribute('title');
        const txt = (r.innerText || '').trim().split('\n')[0];
        const img = r.querySelector('img');
        const code = img && img.getAttribute('data-card-art-source') ? (img.getAttribute('data-card-art-source').match(/([A-Z]{2,4}-R?\d{2,3}[A-Z]?)\.webp/) || [])[1] : null;
        return { title: t, count: txt, code };
      }) : [];
      out[sec] = rows;
    }
    return out;
  });
  console.log(JSON.stringify(deck, null, 1).slice(0, 6000));
  fs.writeFileSync(path.join(__dirname, '..', 'browser', '24-riven-deck.json'), JSON.stringify(deck, null, 1));
  await browser.close();
})().catch((e) => { console.error('FATAL', e); process.exit(1); });
