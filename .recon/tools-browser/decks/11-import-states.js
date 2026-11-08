// Import dialog: invalid state, warnings, use deck code tab. Read-only.
const { launch, shot } = require('../lib');
const fs = require('fs');
const path = require('path');
const O = (n, d) => fs.writeFileSync(path.resolve(__dirname, '../../browser/decks', n), typeof d === 'string' ? d : JSON.stringify(d, null, 2));

(async () => {
  const { browser, page } = await launch();
  await page.goto('https://riftatlas.com/decks/new', { waitUntil: 'domcontentloaded', timeout: 90000 });
  try { await page.waitForLoadState('networkidle', { timeout: 45000 }); } catch {}
  await page.waitForTimeout(2500);
  await page.getByRole('button', { name: 'Import deck', exact: true }).click({ force: true });
  await page.waitForTimeout(600);
  const ta = page.locator('textarea[placeholder*="Paste Riftbound"]');

  // invalid
  await ta.fill('Legend:\n1 Not A Real Card\nChampion:\n1 Also Fake\nMain Deck:\n4 Defy\nBattlefields:\n1 Back-Alley Bar\nRunes:\n12 Calm Rune\n');
  await page.waitForTimeout(1000);
  const invalid = await page.evaluate(() => {
    const d = document.querySelector('[role=dialog]');
    return d ? { text: (d.innerText || '').replace(/\s+/g, ' ').slice(0, 3000), html: d.outerHTML.slice(0, 30000) } : null;
  });
  O('import-invalid.json', invalid);
  console.log('INVALID:', invalid?.text);
  await shot(page, 'decks/23-import-invalid-1920');

  // warnings: valid but non-standard stuff
  await ta.fill('Legend:\n1 Ahri, Nine-Tailed Fox\nChampion:\n1 Ahri, Alluring\nMain Deck:\n3 Defy\n3 Defy\nBattlefields:\n1 Back-Alley Bar\n1 Back-Alley Bar\n1 Emperor\'s Dais\nRunes:\n6 Calm Rune\n6 Mind Rune\n');
  await page.waitForTimeout(1000);
  const warn = await page.evaluate(() => {
    const d = document.querySelector('[role=dialog]');
    return d ? { text: (d.innerText || '').replace(/\s+/g, ' ').slice(0, 3000) } : null;
  });
  O('import-warnings.json', warn);
  console.log('WARN:', warn?.text);
  await shot(page, 'decks/24-import-warnings-1920');

  // use deck code tab
  await page.getByRole('button', { name: /Use Deck Code/i }).click({ force: true });
  await page.waitForTimeout(800);
  const code = await page.evaluate(() => {
    const d = document.querySelector('[role=dialog]');
    return d ? { text: (d.innerText || '').replace(/\s+/g, ' ').slice(0, 1500), html: d.outerHTML.slice(0, 15000) } : null;
  });
  O('import-deckcode-tab.json', code);
  console.log('DECKCODE TAB:', code?.text);
  await shot(page, 'decks/25-import-deckcode-1920');

  await browser.close();
})().catch((e) => { console.error('FATAL', e.stack?.slice(0, 1200)); process.exit(1); });
