// Import a full deck client-side, capture filled states, stats, export, copy. Read-only.
const { launch, shot, saveJSON } = require('../lib');
const fs = require('fs');
const path = require('path');
const O = (n, d) => fs.writeFileSync(path.resolve(__dirname, '../../browser/decks', n), typeof d === 'string' ? d : JSON.stringify(d, null, 2));

(async () => {
  const { browser, context, page } = await launch();
  await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: 'https://riftatlas.com' }).catch(() => {});
  await page.goto('https://riftatlas.com/decks/new', { waitUntil: 'domcontentloaded', timeout: 90000 });
  try { await page.waitForLoadState('networkidle', { timeout: 45000 }); } catch {}
  await page.waitForTimeout(2500);

  // import
  await page.getByRole('button', { name: 'Import deck', exact: true }).click({ force: true });
  await page.waitForTimeout(700);
  const ta = page.locator('textarea[placeholder*="Paste Riftbound deck export"]');
  console.log('textarea count', await ta.count());
  const deckText = fs.readFileSync('/tmp/opencode/riven-deck.txt', 'utf8');
  await ta.fill(deckText);
  await page.waitForTimeout(1200);
  const valText = await page.evaluate(() => {
    const d = document.querySelector('[role=dialog]');
    return (d?.innerText || '').replace(/\s+/g, ' ').slice(0, 2500);
  });
  console.log('IMPORT VALIDATION:', valText);
  await shot(page, 'decks/12-import-filled-1920');
  const importBtn = page.getByRole('button', { name: /^Import Deck$/ }).last();
  console.log('import btn disabled:', await importBtn.isDisabled());
  await importBtn.click({ force: true });
  await page.waitForTimeout(2000);

  const state = await page.evaluate(() => {
    const ws = document.querySelector('[data-testid=desktop-deck-workspace-panel]');
    const cat = document.querySelector('[data-testid=deckbuilder-catalog]');
    return {
      name: document.querySelector('#deck-name-input')?.value,
      workspace: (ws?.innerText || '').replace(/\s+/g, ' ').slice(0, 2000),
      catalogSummary: (cat?.innerText || '').replace(/\s+/g, ' ').slice(0, 500),
      storage: Object.fromEntries(Object.keys(localStorage).filter((k) => k.includes('deckbuilder')).map((k) => [k, String(localStorage.getItem(k)).slice(0, 2000)])),
    };
  });
  O('13-imported-state.json', state);
  console.log('NAME:', state.name);
  console.log('WORKSPACE:', state.workspace);
  console.log('CATALOG:', state.catalogSummary);
  await shot(page, 'decks/13-imported-filled-1920', true);

  // issues (likely 0)
  const issueBtn = page.locator('button').filter({ hasText: /issues?$/ }).first();
  console.log('issue label:', (await issueBtn.innerText().catch(() => '')), 'disabled:', await issueBtn.isDisabled().catch(() => '?'));
  if (await issueBtn.count()) {
    await issueBtn.click({ force: true });
    await page.waitForTimeout(700);
    const pop = await page.evaluate(() => {
      const all = [...document.querySelectorAll('div')].filter((e) => /required section|exactly|at most|can contain|is banned|not legal|Unknown/i.test(e.innerText || ''));
      const e = all.sort((a, b) => a.innerText.length - b.innerText.length)[0];
      return e ? { text: (e.innerText || '').replace(/\s+/g, ' ').slice(0, 2000), html: e.outerHTML.slice(0, 10000) } : null;
    });
    O('14-issues-filled.json', pop);
    console.log('ISSUES FILLED:', pop?.text || '(none)');
    await shot(page, 'decks/14-issues-filled-1920');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
  }

  // stats tab
  await page.getByText('Stats', { exact: true }).first().click({ force: true });
  await page.waitForTimeout(1200);
  const stats = await page.evaluate(() => {
    const ws = document.querySelector('[data-testid=desktop-deck-workspace-panel]');
    return (ws?.innerText || '').replace(/\s+/g, ' ').slice(0, 3000);
  });
  O('15-stats.json', stats);
  console.log('STATS:', stats);
  await shot(page, 'decks/15-stats-1920');

  // back to list, export menu, copy decklist
  await page.getByText('List', { exact: true }).first().click({ force: true });
  await page.waitForTimeout(400);
  const exp = page.locator('button[aria-label="Export deck"]');
  await exp.click({ force: true });
  await page.waitForTimeout(700);
  const expText = await page.evaluate(() => {
    const all = [...document.querySelectorAll('[role=menu],[data-radix-popper-content-wrapper],[role=dialog]')].map((e) => (e.innerText || '').replace(/\s+/g, ' ').trim()).filter(Boolean);
    return all;
  });
  console.log('EXPORT MENU:', expText);
  const copyList = page.getByRole('menuitem', { name: /Copy decklist/i }).first();
  if (await copyList.count()) {
    await copyList.click({ force: true });
    await page.waitForTimeout(700);
    const clip = await page.evaluate(() => navigator.clipboard.readText().catch((e) => 'ERR:' + e.message));
    O('16-export-decklist.txt', clip);
    console.log('CLIPBOARD (decklist):\n' + String(clip).slice(0, 1800));
  }
  await shot(page, 'decks/16-after-copy-1920');

  // reopen export, copy code
  await exp.click({ force: true });
  await page.waitForTimeout(500);
  const copyCode = page.getByRole('menuitem', { name: /Copy deck code/i }).first();
  if (await copyCode.count()) {
    await copyCode.click({ force: true });
    await page.waitForTimeout(600);
    const clip = await page.evaluate(() => navigator.clipboard.readText().catch((e) => 'ERR:' + e.message));
    O('17-export-deckcode.txt', clip);
    console.log('CLIPBOARD (deckcode):', String(clip).slice(0, 500));
  }

  // save gate with full deck
  await page.getByRole('button', { name: 'Save', exact: true }).click({ force: true });
  await page.waitForTimeout(1000);
  const saveDlg = await page.evaluate(() => [...document.querySelectorAll('dialog[open]')].map((d) => ({ text: (d.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 1200) })));
  console.log('SAVE GATE FULL:', saveDlg);
  await shot(page, 'decks/18-save-gate-filled-1920');

  await browser.close();
})().catch((e) => { console.error('FATAL', e.stack?.slice(0, 1500)); process.exit(1); });
