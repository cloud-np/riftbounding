// Look for copy/export on deck detail page; read clipboard if possible
const { launch, shot, saveJSON } = require('./lib');

(async () => {
  const { browser, context, page } = await launch();
  await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: 'https://riftatlas.com' }).catch(() => {});
  await page.goto('https://riftatlas.com/decks/community/jh799bw9vxekd68b9vf6hz0zh18fwjc3', { waitUntil: 'domcontentloaded', timeout: 60000 });
  try { await page.waitForLoadState('networkidle', { timeout: 30000 }); } catch {}
  await page.waitForTimeout(4000);

  const btns = await page.evaluate(() => [...document.querySelectorAll('button, a, [role=button]')].map((b) => ({ tag: b.tagName, t: (b.innerText || b.getAttribute('aria-label') || '').trim().slice(0, 50), cls: String(b.className).slice(0, 100) })).filter((b) => b.t));
  console.log('--- all buttons/links ---');
  btns.forEach((b) => console.log(b.tag, '|', b.t, '|', b.cls.slice(0, 60)));
  saveJSON('22-deck-detail-buttons', btns);

  // click copy-ish buttons and read clipboard
  for (const pat of [/copy/i, /export/i, /share/i, /code/i]) {
    const el = page.locator(`button:has-text(${JSON.stringify(pat.source.replace(/[\\/]/g, ''))})`).first();
    const cnt = await el.count().catch(() => 0);
    if (cnt) {
      try {
        await el.click();
        await page.waitForTimeout(1200);
        const clip = await page.evaluate(() => navigator.clipboard.readText()).catch((e) => 'ERR:' + e.message);
        console.log(`--- after click ${pat}: clipboard ---`);
        console.log(String(clip).slice(0, 2000));
        await shot(page, '22-after-copy-click');
      } catch (e) { console.log('click fail', pat, e.message.slice(0, 100)); }
    }
  }
  await browser.close();
})().catch((e) => { console.error('FATAL', e); process.exit(1); });
