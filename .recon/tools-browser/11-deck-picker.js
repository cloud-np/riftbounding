// Explore deck chooser in lobby
const { launch, shot, dumpDOM, saveJSON } = require('./lib');

(async () => {
  const { browser, page, log } = await launch();
  await page.goto('https://play.riftatlas.com/', { waitUntil: 'domcontentloaded', timeout: 60000 });
  try { await page.waitForLoadState('networkidle', { timeout: 30000 }); } catch {}
  await page.waitForTimeout(3000);

  // Click CHOOSE DECK
  const chooseBtn = page.getByRole('button', { name: /choose deck/i });
  console.log('choose deck visible:', await chooseBtn.isVisible().catch(() => false));
  await chooseBtn.click();
  await page.waitForTimeout(2500);
  await shot(page, '11-deck-picker');
  await dumpDOM(page, '[role=dialog], [class*=modal], [class*=dialog], [class*=overlay], [class*=Modal]', '11-deck-picker-dom', 5);

  // inventory of visible text in any dialog-ish overlay
  const overlayText = await page.evaluate(() => {
    const cands = [...document.querySelectorAll('div')].filter((d) => {
      const s = getComputedStyle(d);
      return (s.position === 'fixed' || s.position === 'absolute') && d.offsetWidth > 300 && d.offsetHeight > 200;
    });
    return cands.slice(-3).map((d) => (d.innerText || '').slice(0, 3000));
  });
  console.log('--- overlay text ---');
  console.log(overlayText.join('\n=====\n').slice(0, 4000));

  // list clickable items inside overlays
  const items = await page.evaluate(() => {
    return [...document.querySelectorAll('button, a, [role=button], li[class*=cursor], [class*=deck-item], [data-deck], [class*=DeckCard]')]
      .map((el) => { const r = el.getBoundingClientRect(); return { t: (el.innerText || '').trim().slice(0, 80), cls: String(el.className).slice(0, 100), rect: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) } }; })
      .filter((x) => x.rect.w > 0 && x.rect.h > 0);
  });
  saveJSON('11-deck-picker-items', items);
  console.log('items count:', items.length);

  await browser.close();
})().catch((e) => { console.error('FATAL', e); process.exit(1); });
