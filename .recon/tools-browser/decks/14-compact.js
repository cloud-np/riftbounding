// Compact-width (1000/390) screenshots, with draft preloaded in localStorage.
const { launch, shot } = require('../lib');
const fs = require('fs');

const draft = fs.readFileSync('/tmp/opencode/riven-draft.json', 'utf8');

async function setDraft(page) {
  await page.evaluate((d) => localStorage.setItem('riftatlas_deckbuilder_draft_v1', d), draft);
  await page.reload({ waitUntil: 'domcontentloaded' });
  try { await page.waitForLoadState('networkidle', { timeout: 30000 }); } catch {}
  await page.waitForTimeout(1800);
}

(async () => {
  const { browser } = await launch();
  for (const w of [1000, 390]) {
    const h = w === 390 ? 844 : 900;
    const context = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
    const page = await context.newPage();
    await page.goto('https://riftatlas.com/decks/new', { waitUntil: 'domcontentloaded', timeout: 90000 });
    await page.waitForTimeout(1800);
    const tag = `decks/w${w}`;

    // empty states
    await shot(page, `${tag}-01-empty`);
    const filter = page.locator('button[aria-label="Filter cards"], button[aria-label*="Filter"]').first();
    await filter.click({ force: true });
    await page.waitForTimeout(600);
    await shot(page, `${tag}-02-filter`);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
    const view = page.locator('[data-testid=deckbuilder-catalog-view-options]').first();
    if (await view.count()) {
      await view.click({ force: true });
      await page.waitForTimeout(500);
      await shot(page, `${tag}-03-view`);
      await page.keyboard.press('Escape');
      await page.waitForTimeout(300);
    }
    const search = page.locator('[data-testid=deckbuilder-catalog-search]');
    await search.fill('Riven');
    await page.waitForTimeout(600);
    await shot(page, `${tag}-04-search`);
    await search.fill('');
    await page.waitForTimeout(400);
    const details = page.locator('button[aria-label^="View details for"]').first();
    if (await details.count()) {
      await details.click({ force: true });
      await page.waitForTimeout(700);
      await shot(page, `${tag}-05-card-detail`);
      await page.keyboard.press('Escape');
      await page.waitForTimeout(300);
    }
    await page.locator('button[aria-label="Champion"]').first().click({ force: true });
    await page.waitForTimeout(500);
    await shot(page, `${tag}-06-section-gated`);

    // partial issues
    await page.locator('button[aria-label="Legend"]').first().click({ force: true });
    await page.waitForTimeout(300);
    await page.locator('button[aria-label="Add Ahri, Nine-Tailed Fox to the selected deck section"]').first().click({ force: true });
    await page.waitForTimeout(600);
    const issueBtn = page.locator('button:has-text("issues")').first();
    if (await issueBtn.count()) {
      await issueBtn.click({ force: true });
      await page.waitForTimeout(500);
      await shot(page, `${tag}-07-issues`);
      await page.keyboard.press('Escape');
      await page.waitForTimeout(300);
    }

    // loaded draft
    await setDraft(page);
    await shot(page, `${tag}-09-imported`);

    // open drawer
    const toggle = page.locator('[data-testid=mobile-deck-drawer-toggle]').first();
    if (await toggle.count()) {
      await toggle.click({ force: true });
      await page.waitForTimeout(600);
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

    // named + save gate (mobile: save inside drawer)
    if (await toggle.count()) {
      await toggle.click({ force: true });
      await page.waitForTimeout(500);
    }
    const save = page.locator('button').filter({ hasText: /^Save$/ }).first();
    if (await save.count()) {
      await save.click({ force: true });
      await page.waitForTimeout(900);
      await shot(page, `${tag}-15-save-gate`);
    }

    await context.close();
    console.log('done width', w);
  }
  await browser.close();
})().catch((e) => { console.error('FATAL', e.stack?.slice(0, 1500)); process.exit(1); });
