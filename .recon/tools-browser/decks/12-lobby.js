// Lobby deck integration: import deck guest, deck summary, choose/save gates, builder play gate.
const { launch, shot } = require('../lib');
const fs = require('fs');
const path = require('path');
const O = (n, d) => fs.writeFileSync(path.resolve(__dirname, '../../browser/decks', n), typeof d === 'string' ? d : JSON.stringify(d, null, 2));

(async () => {
  const { browser, page } = await launch();
  const deckText = fs.readFileSync('/tmp/opencode/riven-deck.txt', 'utf8');

  await page.goto('https://play.riftatlas.com/', { waitUntil: 'domcontentloaded', timeout: 90000 });
  try { await page.waitForLoadState('networkidle', { timeout: 45000 }); } catch {}
  await page.waitForTimeout(4000);

  await page.getByRole('button', { name: /Import Deck/i }).first().click({ force: true });
  await page.waitForTimeout(800);
  const ta = page.locator('textarea[placeholder*="Paste Riftbound"]');
  console.log('lobby textarea', await ta.count());
  await ta.fill(deckText);
  await page.waitForTimeout(1200);
  await shot(page, 'decks/26-lobby-import-1920');
  const imp = page.getByRole('button', { name: /^Import Deck$/ }).last();
  console.log('import disabled', await imp.isDisabled());
  await imp.click({ force: true });
  await page.waitForTimeout(2000);
  const lobby = await page.evaluate(() => ({
    text: (document.body.innerText || '').replace(/\s+/g, ' ').slice(0, 2500),
    mode: document.querySelector('[data-quick-match-summary]')?.textContent,
    deckPanel: (document.querySelector('.lobby-deck-column')?.innerText || '').replace(/\s+/g, ' ').slice(0, 1000),
    storage: Object.fromEntries(Object.keys(localStorage).filter((k) => /deck|draft/i.test(k)).map((k) => [k, String(localStorage.getItem(k)).slice(0, 1000)])),
  }));
  O('26-lobby-imported.json', lobby);
  console.log('MODE:', lobby.mode);
  console.log('DECK PANEL:', lobby.deckPanel);
  await shot(page, 'decks/27-lobby-deck-1920', true);

  // choose deck gate
  await page.getByRole('button', { name: /Choose Deck/i }).first().click({ force: true });
  await page.waitForTimeout(1200);
  const dlg = await page.evaluate(() => [...document.querySelectorAll('dialog[open]')].map((d) => ({ text: (d.innerText || '').replace(/\s+/g, ' ').slice(0, 800) })));
  console.log('CHOOSE GATE:', JSON.stringify(dlg));
  await shot(page, 'decks/28-lobby-choose-gate-1920');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(500);

  // save deck gate
  const save = page.getByRole('button', { name: /Save Deck/i }).first();
  console.log('save disabled', await save.isDisabled().catch(() => '?'));
  if (!(await save.isDisabled().catch(() => true))) {
    await save.click({ force: true });
    await page.waitForTimeout(1000);
    await shot(page, 'decks/29-lobby-save-gate-1920');
  }

  // builder play gate
  await page.goto('https://riftatlas.com/decks/new', { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForTimeout(2500);
  await page.getByRole('button', { name: 'Import deck', exact: true }).click({ force: true });
  await page.waitForTimeout(500);
  await page.locator('textarea[placeholder*="Paste Riftbound"]').fill(deckText);
  await page.waitForTimeout(800);
  await page.getByRole('button', { name: /^Import Deck$/ }).last().click({ force: true });
  await page.waitForTimeout(1500);
  const play = page.getByRole('button', { name: /Play in Simulator/i }).first();
  console.log('play disabled', await play.isDisabled());
  await play.click({ force: true });
  await page.waitForTimeout(1200);
  const pdlg = await page.evaluate(() => [...document.querySelectorAll('dialog[open]')].map((d) => ({ text: (d.innerText || '').replace(/\s+/g, ' ').slice(0, 800) })));
  console.log('PLAY GATE:', JSON.stringify(pdlg));
  await shot(page, 'decks/30-builder-play-gate-1920');

  await browser.close();
})().catch((e) => { console.error('FATAL', e.stack?.slice(0, 1500)); process.exit(1); });
