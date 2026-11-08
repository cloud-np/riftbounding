// Probe guide editor lazy load, copy limit, export menu DOM.
const { launch, shot, saveJSON } = require('../lib');
const fs = require('fs');
const path = require('path');
const O = (n, d) => fs.writeFileSync(path.resolve(__dirname, '../../browser/decks', n), typeof d === 'string' ? d : JSON.stringify(d, null, 2));

(async () => {
  const { browser, page, log } = await launch();
  await page.goto('https://riftatlas.com/decks/new', { waitUntil: 'domcontentloaded', timeout: 90000 });
  try { await page.waitForLoadState('networkidle', { timeout: 45000 }); } catch {}
  await page.waitForTimeout(2500);

  // copy limit
  await page.locator('button[aria-label="Main Deck"]').first().click();
  await page.waitForTimeout(1000);
  for (let i = 0; i < 4; i++) {
    const b = page.locator('button[aria-label^="Add "][aria-label$=" to the selected deck section"]').first();
    const label = await b.getAttribute('aria-label');
    console.log(i, 'click', label, 'disabled', await b.isDisabled());
    await b.click({ force: true }).catch((e) => console.log('click fail', e.message.slice(0, 100)));
    await page.waitForTimeout(500);
  }
  const limit = await page.evaluate(() => {
    const btn = [...document.querySelectorAll('button')].find((b) => /Add .*to the selected deck section/.test(b.getAttribute('aria-label') || ''));
    const texts = [...document.querySelectorAll('body *')].filter((e) => /maximum|max/i.test((e.innerText || '').slice(0, 300)) && (e.innerText || '').length < 300).map((e) => (e.innerText || '').replace(/\s+/g, ' ').slice(0, 200));
    return { aria: btn?.getAttribute('aria-label'), disabled: btn?.disabled, title: btn?.title, texts: [...new Set(texts)].slice(0, 8) };
  });
  O('copy-limit.json', limit);
  console.log('LIMIT:', JSON.stringify(limit));
  await shot(page, 'decks/probe-copy-limit');

  // export menu
  const exp = page.locator('button[aria-label="Export deck"]');
  await exp.click({ force: true });
  await page.waitForTimeout(600);
  const menu = await page.evaluate(() => {
    const cands = [...document.querySelectorAll('[role=menu],[role=dialog],[data-radix-popper-content-wrapper]')].filter((e) => e.offsetParent !== null);
    return cands.map((e) => ({ role: e.getAttribute('role'), html: e.outerHTML.slice(0, 20000), text: (e.innerText || '').replace(/\s+/g, ' ').slice(0, 600) }));
  });
  O('export-menu-dom.json', menu);
  console.log('EXPORT MENU DOM:', menu.map((x) => x.text).join(' || '));
  const items = await page.evaluate(() => [...document.querySelectorAll('button,[role=menuitem]')].filter((e) => e.offsetParent !== null && /Copy decklist|Copy deck code|Compact share|Share deck|Download wallpaper/.test(e.innerText || '')).map((e) => ({ t: (e.innerText || '').replace(/\s+/g, ' ').slice(0, 80), role: e.getAttribute('role'), aria: e.getAttribute('aria-label') })));
  console.log('ITEMS:', JSON.stringify(items));
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);

  // guide editor
  log.network.length = 0;
  const guide = page.locator('button').filter({ hasText: /^Guide$/ }).first();
  await guide.click({ force: true });
  for (let i = 0; i < 10; i++) {
    await page.waitForTimeout(1000);
    const txt = await page.evaluate(() => (document.body.innerText || '').replace(/\s+/g, ' '));
    if (/Guide editor|Deck guide|Writing|Save guide|Edit guide/i.test(txt)) break;
  }
  const gd = await page.evaluate(() => {
    const cands = [...document.querySelectorAll('[role=dialog],dialog[open],main section,body > div')].filter((e) => e.offsetParent !== null);
    return cands.map((e) => ({ tag: e.tagName, text: (e.innerText || '').replace(/\s+/g, ' ').slice(0, 1200), cls: String(e.className).slice(0, 160) })).filter((x) => /guide|Guide/i.test(x.text));
  });
  O('guide-editor.json', gd);
  console.log('GUIDE EDITOR:', JSON.stringify(gd).slice(0, 1800));
  console.log('GUIDE CHUNKS:', [...new Set(log.network.filter((r) => r.kind === 'req' && /\.js/.test(r.url)).map((r) => r.url.split('/').pop()))].join(', '));
  await shot(page, 'decks/probe-guide-editor');
  await browser.close();
})().catch((e) => { console.error('FATAL', e.stack?.slice(0, 1200)); process.exit(1); });
