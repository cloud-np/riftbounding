// Misc public UI: mode CHANGE picker, tabs, Ctrl+K card browser, hover preview, Customize, Game history, Sealed, New deck
const { launch, shot, saveJSON, dumpDOM } = require('./lib');
const fs = require('fs');
const path = require('path');

const deck = JSON.parse(fs.readFileSync(path.resolve(__dirname, '..', 'browser', '24-riven-deck.json'), 'utf8'));
function buildDeckText() {
  const line = (c) => `${parseInt(c.count, 10)} ${c.title}`;
  const p = [];
  p.push('Legend:'); deck.LEGEND.forEach((c) => p.push(line(c)));
  p.push('', 'Champion:'); deck.CHAMPION.forEach((c) => p.push(line(c)));
  p.push('', 'Main Deck:'); deck['MAIN DECK'].forEach((c) => p.push(line(c)));
  p.push('', 'Battlefields:'); deck.BATTLEFIELDS.forEach((c) => p.push(line(c)));
  p.push('', 'Runes:'); deck.RUNES.forEach((c) => p.push(line(c)));
  p.push('', 'Sideboard:'); deck.SIDEBOARD.forEach((c) => p.push(line(c)));
  return p.join('\n');
}

(async () => {
  const { browser, page } = await launch();
  const results = {};
  await page.goto('https://play.riftatlas.com/', { waitUntil: 'domcontentloaded', timeout: 60000 });
  try { await page.waitForLoadState('networkidle', { timeout: 30000 }); } catch {}
  await page.waitForTimeout(3000);

  // import deck to enable hover-preview tests
  await page.getByRole('button', { name: /import deck/i }).click();
  await page.waitForTimeout(800);
  await page.locator('textarea').first().fill(buildDeckText());
  await page.waitForTimeout(1200);
  await page.getByRole('dialog').getByRole('button', { name: /^import deck$/i }).click();
  await page.waitForTimeout(1800);

  // 1. mode CHANGE picker
  await page.getByRole('button', { name: /^change$/i }).click();
  await page.waitForTimeout(1500);
  await shot(page, '32-mode-change-picker');
  results.modePicker = await page.evaluate(() => { const d = document.querySelector('[role=dialog], dialog[open]'); return d ? d.innerText.slice(0, 1200) : null; });
  console.log('MODE PICKER:', results.modePicker);
  await dumpDOM(page, '[role=dialog], dialog[open]', '32-mode-picker-dom', 1);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(800);

  // 2. PRE-RIFT tab (likely disabled pre-login)
  const preRiftBtn = page.getByRole('button', { name: /pre-rift/i });
  results.preRiftDisabled = await preRiftBtn.isDisabled().catch(() => null);
  results.preRiftTitle = await preRiftBtn.getAttribute('title').catch(() => null);
  if (!results.preRiftDisabled) { await preRiftBtn.click(); await page.waitForTimeout(1200); await shot(page, '33-prerift-tab'); }
  console.log('PRE-RIFT disabled:', results.preRiftDisabled, results.preRiftTitle);

  // back to constructed
  await page.getByRole('button', { name: /^constructed$/i }).click({ timeout: 5000 }).catch(() => {});
  await page.waitForTimeout(800);

  // 3. hover a deck card row (preview?)
  const row = page.locator('[title="Astral Heron"]').first();
  if (await row.count()) {
    await row.hover();
    await page.waitForTimeout(1500);
    await shot(page, '34-lobby-card-hover');
  }

  // 4. STATS tab
  const stats = page.locator('#deck-stats-tab');
  if (await stats.count()) { await stats.click(); await page.waitForTimeout(1200); await shot(page, '35-lobby-deck-stats'); }
  const list = page.locator('#deck-list-tab');
  if (await list.count()) { await list.click(); await page.waitForTimeout(600); }

  // 5. Ctrl+K card browser overlay
  await page.keyboard.press('Control+k');
  await page.waitForTimeout(2000);
  await shot(page, '36-ctrl-k-card-browser');
  results.ctrlK = await page.evaluate(() => { const d = document.querySelector('[role=dialog], dialog[open]'); return d ? d.innerText.slice(0, 800) : document.body.innerText.slice(0, 400); });
  console.log('CTRL+K:', JSON.stringify(results.ctrlK).slice(0, 500));
  await page.keyboard.press('Escape');
  await page.waitForTimeout(800);

  // 6. Game history
  await page.getByRole('button', { name: /game history/i }).click();
  await page.waitForTimeout(1500);
  await shot(page, '37-game-history');
  results.gameHistory = await page.evaluate(() => { const d = document.querySelector('[role=dialog], dialog[open]'); return { dialog: d ? d.innerText.slice(0, 400) : null, url: location.href }; });
  console.log('GAME HISTORY:', JSON.stringify(results.gameHistory).slice(0, 400));
  await page.keyboard.press('Escape');
  await page.waitForTimeout(600);

  saveJSON('32-36-misc-ui', results);

  // 7. Customize page
  await page.goto('https://play.riftatlas.com/customize', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(3500);
  await shot(page, '38-customize');

  // 8. Sealed page
  await page.goto('https://riftatlas.com/sealed', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(4000);
  await shot(page, '39-sealed');

  // 9. New deck builder
  await page.goto('https://riftatlas.com/decks/new', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(4000);
  await shot(page, '40-decks-new');

  await browser.close();
})().catch((e) => { console.error('FATAL', e); process.exit(1); });
