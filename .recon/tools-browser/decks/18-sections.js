// Section-specific pool screenshots with a full draft loaded.
const { launch, shot } = require('../lib');
const fs = require('fs');
const draft = fs.readFileSync('/tmp/opencode/riven-draft.json', 'utf8');

(async () => {
  const { browser } = await launch();
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  await context.addInitScript((d) => {
    try { if (location.hostname === 'riftatlas.com') localStorage.setItem('riftatlas_deckbuilder_draft_v1', d); } catch {}
  }, draft);
  const page = await context.newPage();
  await page.goto('https://riftatlas.com/decks/new', { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForTimeout(3000);
  for (const [label, file] of [['Champion', '48-section-champion'], ['Battlefields', '49-section-battlefields'], ['Runes', '50-section-runes'], ['Sideboard', '51-section-sideboard']]) {
    await page.locator(`button[aria-label="${label}"]`).first().click({ force: true });
    await page.waitForTimeout(800);
    await shot(page, `decks/${file}-1920`);
  }
  await browser.close();
})().catch((e) => { console.error('FATAL', e.message); process.exit(1); });
