// Save key DOM snapshots (prettified later): workspace, populated section, list row, mobile drawer, import dialog, card detail, filter, view.
const { launch } = require('../lib');
const fs = require('fs');
const path = require('path');
const draft = fs.readFileSync('/tmp/opencode/riven-draft.json', 'utf8');
const OUT = path.resolve(__dirname, '../../browser/decks');

(async () => {
  const { browser } = await launch();
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  await context.addInitScript((d) => {
    try { if (location.hostname === 'riftatlas.com') localStorage.setItem('riftatlas_deckbuilder_draft_v1', d); } catch {}
  }, draft);
  const page = await context.newPage();
  await page.goto('https://riftatlas.com/decks/new', { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForTimeout(3500);

  const save = async (sel, name, all = false) => {
    const html = await page.evaluate(({ s, a }) => {
      const els = a ? [...document.querySelectorAll(s)] : [document.querySelector(s)];
      return els.filter(Boolean).map((e) => e.outerHTML).join('\n<!-- ==== -->\n');
    }, { s: sel, a: all });
    fs.writeFileSync(path.join(OUT, name), html);
    console.log(name, html.length);
  };

  await save('[data-deck-workspace-header]', 'dom-workspace-header-full.html');
  await save('[data-deck-workspace-section="mainDeck"]', 'dom-section-maindeck.html');
  await save('[data-deck-workspace-section="legend"]', 'dom-section-legend-filled.html');
  await save('[data-deck-list-row]', 'dom-deck-rows.html', true).catch(() => {});
  // find a deck list row by known class/data
  const rowSel = await page.evaluate(() => {
    const cands = [...document.querySelectorAll('[data-deck-list-entry], [data-deck-list-row], [data-deck-workspace-entry], li, article')].filter((e) => /Astral Heron/.test(e.innerText || ''));
    const e = cands.sort((a, b) => (a.innerText || '').length - (b.innerText || '').length)[0];
    if (!e) return null;
    e.setAttribute('data-b26-row', '1');
    return '[data-b26-row="1"]';
  });
  if (rowSel) await save(rowSel, 'dom-deck-row.html');

  // filter on main deck
  await page.locator('button[aria-label="Main Deck"]').first().click({ force: true });
  await page.waitForTimeout(500);
  await page.locator('button[aria-label="Filter cards"]').first().click({ force: true });
  await page.waitForTimeout(600);
  await save('[role=dialog]', 'dom-filter-dialog.html');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
  await page.locator('[data-testid=deckbuilder-catalog-view-options]').first().click({ force: true });
  await page.waitForTimeout(500);
  await save('[role=dialog]', 'dom-view-dialog.html');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);

  // card detail
  await page.locator('button[aria-label^="View details for"]').first().click({ force: true });
  await page.waitForTimeout(700);
  const detail = await page.evaluate(() => {
    const e = [...document.querySelectorAll('[role=dialog],dialog[open]')].filter((x) => x.offsetParent !== null).sort((a, b) => (a.innerText || '').length - (b.innerText || '').length)[0];
    return e ? e.outerHTML : '';
  });
  fs.writeFileSync(path.join(OUT, 'dom-card-detail-dialog.html'), detail);
  console.log('card detail', detail.length);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);

  // import dialog
  await page.locator('button[aria-label="Import deck"]').first().click({ force: true });
  await page.waitForTimeout(600);
  await save('[role=dialog]', 'dom-import-dialog.html');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);

  // mobile drawer
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(800);
  await page.locator('[data-testid=mobile-deck-drawer-toggle]').first().click({ force: true });
  await page.waitForTimeout(600);
  await save('[data-testid=mobile-deck-workspace-panel]', 'dom-mobile-drawer.html');

  await browser.close();
})().catch((e) => { console.error('FATAL', e.stack?.slice(0, 1200)); process.exit(1); });
