// Full screenshot battery for the deck builder at 1920/1440/1000/390. Read-only.
const { launch, shot } = require('../lib');
const fs = require('fs');

const deckText = fs.readFileSync('/tmp/opencode/riven-deck.txt', 'utf8');

async function build(page) {
  await page.goto('https://riftatlas.com/decks/new', { waitUntil: 'domcontentloaded', timeout: 90000 });
  try { await page.waitForLoadState('networkidle', { timeout: 30000 }); } catch {}
  await page.waitForTimeout(2200);
}

async function importDeck(page) {
  await page.getByRole('button', { name: 'Import deck', exact: true }).click({ force: true });
  await page.waitForTimeout(500);
  await page.locator('textarea[placeholder*="Paste Riftbound"]').fill(deckText);
  await page.waitForTimeout(800);
  const dlg = page.locator('[role=dialog]').filter({ hasText: /Import Deck/ }).last();
  const btn = dlg.getByRole('button', { name: /^Import Deck$/ }).last();
  await btn.click({ force: true });
  await page.waitForTimeout(1400);
}

(async () => {
  const { browser } = await launch();

  for (const w of [1920, 1440, 1000, 390]) {
    const h = w === 390 ? 844 : w === 1000 ? 900 : 1080;
    const context = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
    const page = await context.newPage();
    await build(page);
    const tag = `decks/w${w}`;
    await shot(page, `${tag}-01-empty`);

    // filter
    const filter = page.locator('button[aria-label="Filter cards"], button[aria-label*="Filter"]').first();
    await filter.click({ force: true });
    await page.waitForTimeout(700);
    await shot(page, `${tag}-02-filter`);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);

    // view options
    const view = page.locator('[data-testid=deckbuilder-catalog-view-options]').first();
    if (await view.count()) {
      await view.click({ force: true });
      await page.waitForTimeout(600);
      await shot(page, `${tag}-03-view`);
      await page.keyboard.press('Escape');
      await page.waitForTimeout(300);
    }

    // search
    const search = page.locator('[data-testid=deckbuilder-catalog-search]');
    await search.fill('Riven');
    await page.waitForTimeout(700);
    await shot(page, `${tag}-04-search`);
    await search.fill('');
    await page.waitForTimeout(500);

    // card detail
    const details = page.locator('button[aria-label^="View details for"]').first();
    if (await details.count()) {
      await details.click({ force: true });
      await page.waitForTimeout(800);
      await shot(page, `${tag}-05-card-detail`);
      await page.keyboard.press('Escape');
      await page.waitForTimeout(400);
    }

    // section gating states
    await page.locator('button[aria-label="Champion"]').first().click({ force: true });
    await page.waitForTimeout(500);
    await shot(page, `${tag}-06-section-gated`);
    await page.locator('button[aria-label="Legend"]').first().click({ force: true });
    await page.waitForTimeout(400);

    // partial deck + issues
    await page.locator('button[aria-label="Add Ahri, Nine-Tailed Fox to the selected deck section"]').first().click({ force: true });
    await page.waitForTimeout(700);
    const issueBtn = page.locator('button:has-text("issues")').first();
    if (await issueBtn.count()) {
      await issueBtn.click({ force: true });
      await page.waitForTimeout(500);
      await shot(page, `${tag}-07-issues`);
      await page.keyboard.press('Escape');
      await page.waitForTimeout(300);
    }

    // import dialog filled
    await page.getByRole('button', { name: 'Import deck', exact: true }).click({ force: true });
    await page.waitForTimeout(500);
    await page.locator('textarea[placeholder*="Paste Riftbound"]').fill(deckText);
    await page.waitForTimeout(900);
    await shot(page, `${tag}-08-import-filled`);
    const dlg = page.locator('[role=dialog]').filter({ hasText: /Import Deck/ }).last();
    await dlg.getByRole('button', { name: /^Import Deck$/ }).last().click({ force: true });
    await page.waitForTimeout(1500);
    await shot(page, `${tag}-09-imported`);

    // mobile drawer or workspace visible already
    if (w <= 1000) {
      const toggle = page.locator('[data-testid=mobile-deck-drawer-toggle]').first();
      if (await toggle.count()) {
        await toggle.click({ force: true });
        await page.waitForTimeout(700);
        await shot(page, `${tag}-10-drawer`);
        await page.keyboard.press('Escape');
        await page.waitForTimeout(400);
      }
    }

    // stats
    await page.getByText('Stats', { exact: true }).first().click({ force: true });
    await page.waitForTimeout(800);
    await shot(page, `${tag}-11-stats`);

    // full art
    await page.getByText('Full Art', { exact: true }).first().click({ force: true });
    await page.waitForTimeout(800);
    await shot(page, `${tag}-12-fullart`);

    // list + export
    await page.getByText('List', { exact: true }).first().click({ force: true });
    await page.waitForTimeout(500);
    const exp = page.locator('button[aria-label="Export deck"]');
    await exp.click({ force: true });
    await page.waitForTimeout(600);
    await shot(page, `${tag}-13-export`);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);

    // deck name + save gate
    const name = page.locator('#deck-name-input');
    if (await name.count()) {
      await name.fill('B26 Test Deck');
      await page.waitForTimeout(500);
      await shot(page, `${tag}-14-named`);
    }
    await page.getByRole('button', { name: 'Save', exact: true }).click({ force: true });
    await page.waitForTimeout(1000);
    await shot(page, `${tag}-15-save-gate`);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(400);

    await context.close();
    console.log('done width', w);
  }

  await browser.close();
})().catch((e) => { console.error('FATAL', e.stack?.slice(0, 1500)); process.exit(1); });
