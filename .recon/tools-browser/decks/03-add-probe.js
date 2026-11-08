// Probe add-to-deck behavior, copy limits, localStorage. Read-only.
const { launch } = require('../lib');

(async () => {
  const { browser, page } = await launch();
  await page.goto('https://riftatlas.com/decks/new', { waitUntil: 'domcontentloaded', timeout: 90000 });
  try { await page.waitForLoadState('networkidle', { timeout: 45000 }); } catch {}
  await page.waitForTimeout(2500);

  const state = async (tag) => {
    const s = await page.evaluate(() => {
      const text = (document.body.innerText || '').replace(/\s+/g, ' ');
      const ws = document.querySelector('[data-testid=desktop-deck-workspace-panel]');
      const issues = [...document.querySelectorAll('button')].find((b) => /issues|issue/i.test(b.innerText));
      return {
        workspace: (ws?.innerText || '').replace(/\s+/g, ' ').slice(0, 700),
        issues: issues?.innerText,
        storage: Object.fromEntries(Object.keys(localStorage).map((k) => [k, String(localStorage.getItem(k)).slice(0, 1500)])),
      };
    });
    console.log('---', tag, '\n', JSON.stringify(s));
  };
  await state('empty');

  // click first card's add overlay
  const add = page.locator('button[aria-label="Add Ahri, Nine-Tailed Fox to the selected deck section"]');
  console.log('add count', await add.count());
  await add.first().click({ force: true });
  await page.waitForTimeout(900);
  await state('after-add-ahri-1');

  const add2 = page.locator('button[aria-label="Add Akali, Rogue Assassin to the selected deck section"]');
  if (await add2.count()) { await add2.first().click({ force: true }); await page.waitForTimeout(500); }
  await state('after-add-akali');

  // click Ahri add two more times
  for (let i = 0; i < 2; i++) {
    const b = page.locator('button[aria-label="Add Ahri, Nine-Tailed Fox to the selected deck section"]');
    console.log('ahri section-add count', await b.count());
    if (await b.count()) { await b.first().click({ force: true }); await page.waitForTimeout(600); }
  }
  await state('after-add-ahri-3');

  // go Main Deck tab + add a card 4 times
  await page.locator('button[aria-label="Main Deck"]').first().click();
  await page.waitForTimeout(1200);
  const summary = await page.locator('[data-testid=deckbuilder-catalog-summary]').innerText();
  console.log('main summary:', summary);
  const addBtn = page.locator('button[aria-label^="Add "][aria-label$=" to the selected deck section"]').first();
  const al = await addBtn.getAttribute('aria-label').catch(() => null);
  console.log('first add label:', al);
  for (let i = 0; i < 5; i++) {
    const btn = page.locator('button[aria-label^="Add "][aria-label$=" to the selected deck section"]').first();
    if (await btn.count()) { await btn.click({ force: true }); await page.waitForTimeout(500); }
    else console.log('no add btn at', i);
  }
  await state('after-main-add-5');

  await browser.close();
})().catch((e) => { console.error('FATAL', e.stack?.slice(0, 1200)); process.exit(1); });
