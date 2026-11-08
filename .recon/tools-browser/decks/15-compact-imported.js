// Compact-width imported-deck screenshots via addInitScript draft injection.
const { launch, shot } = require('../lib');
const fs = require('fs');
const draft = fs.readFileSync('/tmp/opencode/riven-draft.json', 'utf8');

(async () => {
  const { browser } = await launch();
  for (const w of [1000, 390]) {
    const h = w === 390 ? 844 : 900;
    const context = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
    await context.addInitScript((d) => {
      try {
        if (location.hostname === 'riftatlas.com') localStorage.setItem('riftatlas_deckbuilder_draft_v1', d);
      } catch {}
    }, draft);
    const page = await context.newPage();
    await page.goto('https://riftatlas.com/decks/new', { waitUntil: 'domcontentloaded', timeout: 90000 });
    try { await page.waitForLoadState('networkidle', { timeout: 30000 }); } catch {}
    await page.waitForTimeout(2500);
    const tag = `decks/w${w}`;
    const st = await page.evaluate(() => (document.querySelector('[data-testid=mobile-deck-drawer-toggle]')?.innerText || '').replace(/\s+/g, ' '));
    console.log(w, 'toggle:', st);
    await shot(page, `${tag}-09-imported`);
    const toggle = page.locator('[data-testid=mobile-deck-drawer-toggle]').first();
    if (await toggle.count()) {
      await toggle.click({ force: true });
      await page.waitForTimeout(700);
      await shot(page, `${tag}-10-drawer`);
      const stats = page.getByText('Stats', { exact: true }).first();
      if (await stats.count()) {
        await stats.click({ force: true });
        await page.waitForTimeout(700);
        await shot(page, `${tag}-11-stats`);
      }
      const full = page.getByText('Full Art', { exact: true }).first();
      if (await full.count()) {
        await full.click({ force: true });
        await page.waitForTimeout(700);
        await shot(page, `${tag}-12-fullart`);
      }
      await page.keyboard.press('Escape');
      await page.waitForTimeout(400);
    }
    await context.close();
    console.log('done', w);
  }
  await browser.close();
})().catch((e) => { console.error('FATAL', e.stack?.slice(0, 1200)); process.exit(1); });
