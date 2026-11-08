// Capture export menu, clipboard formats, stats DOM. Read-only.
const { launch, shot } = require('../lib');
const fs = require('fs');
const path = require('path');
const O = (n, d) => fs.writeFileSync(path.resolve(__dirname, '../../browser/decks', n), typeof d === 'string' ? d : JSON.stringify(d, null, 2));

(async () => {
  const { browser, context, page } = await launch();
  await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: 'https://riftatlas.com' }).catch(() => {});
  await page.goto('https://riftatlas.com/decks/new', { waitUntil: 'domcontentloaded', timeout: 90000 });
  try { await page.waitForLoadState('networkidle', { timeout: 45000 }); } catch {}
  await page.waitForTimeout(2500);
  await page.getByRole('button', { name: 'Import deck', exact: true }).click({ force: true });
  await page.waitForTimeout(500);
  await page.locator('textarea[placeholder*="Paste Riftbound"]').fill(fs.readFileSync('/tmp/opencode/riven-deck.txt', 'utf8'));
  await page.waitForTimeout(800);
  await page.getByRole('button', { name: /^Import Deck$/ }).last().click({ force: true });
  await page.waitForTimeout(1500);

  // export menu
  const exp = page.locator('button[aria-label="Export deck"]');
  await exp.click({ force: true });
  await page.waitForTimeout(700);
  const menu = await page.evaluate(() => {
    const all = [...document.querySelectorAll('body *')].filter((e) => {
      const t = (e.innerText || '').replace(/\s+/g, ' ').trim();
      return t.startsWith('EXPORT DECK') && t.length < 400 && e.children.length < 20;
    });
    const m = all.sort((a, b) => a.innerText.length - b.innerText.length)[0];
    return m ? { text: (m.innerText || '').replace(/\s+/g, ' '), html: m.outerHTML.slice(0, 20000) } : null;
  });
  O('export-menu.json', menu);
  console.log('EXPORT MENU:', menu?.text);
  if (menu) {
    const items = await page.evaluate(() => [...document.querySelectorAll('button,[role=menuitem]')].filter((e) => e.offsetParent !== null && /Copy decklist|Copy deck code|Compact share|Share deck|Download wallpaper/.test(e.innerText || '')).map((e) => ({ tag: e.tagName, role: e.getAttribute('role'), t: (e.innerText || '').replace(/\s+/g, ' ').slice(0, 100), aria: e.getAttribute('aria-label') })));
    console.log('ITEMS:', JSON.stringify(items));
    await shot(page, 'decks/20-export-menu-1920');
    // click copy decklist
    const copyList = page.locator('button:has-text("Copy decklist"), [role=menuitem]:has-text("Copy decklist")').first();
    console.log('copyList count', await copyList.count());
    if (await copyList.count()) {
      await copyList.click({ force: true });
      await page.waitForTimeout(700);
      const clip = await page.evaluate(() => navigator.clipboard.readText().catch((e) => 'ERR:' + e.message));
      O('20-decklist-copy.txt', clip);
      console.log('DECKLIST COPY:\n' + String(clip).slice(0, 1200));
    }
    // reopen for deck code
    await exp.click({ force: true });
    await page.waitForTimeout(500);
    const copyCode = page.locator('button:has-text("Copy deck code"), [role=menuitem]:has-text("Copy deck code")').first();
    console.log('copyCode count', await copyCode.count());
    if (await copyCode.count()) {
      await copyCode.click({ force: true });
      await page.waitForTimeout(800);
      const clip = await page.evaluate(() => navigator.clipboard.readText().catch((e) => 'ERR:' + e.message));
      O('21-deckcode-copy.txt', clip);
      console.log('DECKCODE COPY:', String(clip).slice(0, 300));
    }
  }

  // stats DOM
  await page.getByText('Stats', { exact: true }).first().click({ force: true });
  await page.waitForTimeout(900);
  const stats = await page.evaluate(() => {
    const ws = document.querySelector('[data-testid=desktop-deck-workspace-panel]');
    return ws ? { html: ws.outerHTML.slice(0, 30000), text: (ws.innerText || '').replace(/\s+/g, ' ') } : null;
  });
  O('stats-dom.json', stats);
  console.log('STATS TEXT:', stats?.text.slice(0, 2000));

  // full art
  await page.getByText('Full Art', { exact: true }).first().click({ force: true });
  await page.waitForTimeout(900);
  const full = await page.evaluate(() => {
    const ws = document.querySelector('[data-testid=desktop-deck-workspace-panel]');
    return ws ? { text: (ws.innerText || '').replace(/\s+/g, ' ').slice(0, 2000), html: ws.outerHTML.slice(0, 20000) } : null;
  });
  O('fullart-dom.json', full);
  console.log('FULLART TEXT:', full?.text.slice(0, 1200));
  await shot(page, 'decks/22-fullart-1920');

  await browser.close();
})().catch((e) => { console.error('FATAL', e.stack?.slice(0, 1500)); process.exit(1); });
