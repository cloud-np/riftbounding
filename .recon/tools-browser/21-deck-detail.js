// Open a community deck detail page to find decklist + export format
const { launch, shot, saveJSON, dumpDOM } = require('./lib');
const fs = require('fs');
const path = require('path');

(async () => {
  const { browser, page, log } = await launch();
  const url = 'https://riftatlas.com/decks/community/jh799bw9vxekd68b9vf6hz0zh18fwjc3';
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
  try { await page.waitForLoadState('networkidle', { timeout: 30000 }); } catch {}
  await page.waitForTimeout(5000);
  await shot(page, '21-deck-detail', true);
  const txt = await page.evaluate(() => document.body.innerText.slice(0, 5000));
  console.log('--- deck detail text ---');
  console.log(txt);

  // find export/copy/code buttons
  const btns = await page.evaluate(() => [...document.querySelectorAll('button, a')].map((b) => ({ t: (b.innerText || '').trim().slice(0, 40), cls: String(b.className).slice(0, 80) })).filter((b) => /export|copy|code|share|play/i.test(b.t)));
  console.log('--- export-ish buttons ---');
  console.log(JSON.stringify(btns, null, 1));

  const html = await page.content();
  fs.writeFileSync(path.join(__dirname, '..', 'browser', '21-deck-detail.rendered.html'), html);
  await browser.close();
})().catch((e) => { console.error('FATAL', e); process.exit(1); });
