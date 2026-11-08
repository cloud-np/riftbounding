// Inspect cards page DOM structure
const { launch } = require('./lib');
const fs = require('fs');
const path = require('path');

(async () => {
  const { browser, page } = await launch();
  await page.goto('https://riftatlas.com/cards', { waitUntil: 'domcontentloaded', timeout: 60000 });
  try { await page.waitForLoadState('networkidle', { timeout: 40000 }); } catch {}
  await page.waitForTimeout(5000);
  const html = await page.content();
  fs.writeFileSync(path.join(__dirname, '..', 'browser', '18b-cards.rendered.html'), html);

  // find elements whose innerText includes 'Ahri'
  const info = await page.evaluate(() => {
    const hits = [];
    for (const el of document.querySelectorAll('*')) {
      const t = el.innerText || '';
      if (t.includes('Ahri') && t.length < 300) { hits.push({ tag: el.tagName, cls: String(el.className).slice(0, 100), txt: t.slice(0, 120) }); }
      if (hits.length > 12) break;
    }
    const imgs = [...document.querySelectorAll('img')].slice(0, 5).map((i) => ({ src: i.src.slice(0, 140), alt: i.alt, cls: String(i.className).slice(0, 80) }));
    return { hits, imgs };
  });
  console.log(JSON.stringify(info, null, 1));
  await browser.close();
})().catch((e) => { console.error('FATAL', e); process.exit(1); });
