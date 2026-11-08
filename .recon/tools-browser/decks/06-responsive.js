// Probe responsive layout at 1440/1000/390. Read-only.
const { launch, shot } = require('../lib');

(async () => {
  const { browser, page } = await launch();
  await page.goto('https://riftatlas.com/decks/new', { waitUntil: 'domcontentloaded', timeout: 90000 });
  try { await page.waitForLoadState('networkidle', { timeout: 45000 }); } catch {}
  await page.waitForTimeout(2500);
  for (const w of [1920, 1440, 1000, 390]) {
    await page.setViewportSize({ width: w, height: w === 390 ? 844 : 1080 });
    await page.waitForTimeout(800);
    const info = await page.evaluate(() => {
      const vis = (sel) => [...document.querySelectorAll(sel)].filter((e) => e.offsetParent !== null).map((e) => ({ sel, testid: e.getAttribute('data-testid'), txt: (e.innerText || '').replace(/\s+/g, ' ').slice(0, 80), cls: String(e.className).slice(0, 80) }));
      const testids = [...document.querySelectorAll('[data-testid]')].filter((e) => e.offsetParent !== null).map((e) => e.getAttribute('data-testid'));
      return {
        inner: [window.innerWidth, window.innerHeight],
        bodyScrollWidth: document.body.scrollWidth,
        visibleTestids: [...new Set(testids)],
        buttons: [...document.querySelectorAll('button')].filter((b) => b.offsetParent !== null).map((b) => (b.innerText || b.getAttribute('aria-label') || '').replace(/\s+/g, ' ').slice(0, 45)).slice(0, 60),
      };
    });
    console.log('===', w, JSON.stringify(info).slice(0, 2600));
    await shot(page, `decks/layout-${w}`, w === 390);
  }
  await browser.close();
})().catch((e) => { console.error('FATAL', e.message); process.exit(1); });
