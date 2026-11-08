// Explore IMPORT DECK flow (no login)
const { launch, shot, dumpDOM, saveJSON } = require('./lib');

(async () => {
  const { browser, page, log } = await launch();
  await page.goto('https://play.riftatlas.com/', { waitUntil: 'domcontentloaded', timeout: 60000 });
  try { await page.waitForLoadState('networkidle', { timeout: 30000 }); } catch {}
  await page.waitForTimeout(3000);

  await page.getByRole('button', { name: /import deck/i }).click();
  await page.waitForTimeout(2000);
  await shot(page, '12-import-deck-modal');
  await dumpDOM(page, '[role=dialog]', '12-import-deck-dom', 3);

  // What did it open? print visible dialog text and any textarea/input
  const info = await page.evaluate(() => {
    const dlg = document.querySelector('[role=dialog]');
    const text = dlg ? dlg.innerText.slice(0, 2000) : null;
    const inputs = [...document.querySelectorAll('textarea, input[type=text], input:not([type])')].map((el) => {
      const r = el.getBoundingClientRect();
      return { tag: el.tagName.toLowerCase(), placeholder: el.placeholder, cls: String(el.className).slice(0, 120), rect: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) } };
    });
    return { dialogText: text, inputs };
  });
  console.log('dialog text:\n', info.dialogText);
  console.log('inputs:', JSON.stringify(info.inputs, null, 1));
  saveJSON('12-import-deck-info', info);
  await browser.close();
})().catch((e) => { console.error('FATAL', e); process.exit(1); });
