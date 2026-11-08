// Sealed: pack open animation + Play in Simulator state
const { launch, shot } = require('./lib');

(async () => {
  const { browser, page } = await launch();

  // Flow: /sealed -> choose Vendetta Sealed -> products -> open one pack
  await page.goto('https://riftatlas.com/sealed', { waitUntil: 'domcontentloaded', timeout: 60000 });
  try { await page.waitForLoadState('networkidle', { timeout: 30000 }); } catch {}
  await page.waitForTimeout(4000);

  // click first "Open packs" (Radiance Pre-Rift)
  const op = page.getByRole('button', { name: /open packs/i }).first();
  console.log('open packs buttons:', await page.getByRole('button', { name: /open packs/i }).count());
  await op.click();
  await page.waitForTimeout(4000);
  await shot(page, '48e-sealed-products-2');
  console.log('url:', page.url());

  // find "Open" text nodes in DOM
  const opens = await page.evaluate(() => {
    const out = [];
    const walk = (n) => {
      if (n.nodeType === 3 && n.textContent.trim() === 'Open') {
        let el = n.parentElement;
        out.push({ tag: el.tagName, cls: String(el.className).slice(0, 120), outer: el.outerHTML.slice(0, 300) });
      }
      for (const c of n.childNodes) walk(c);
    };
    walk(document.body);
    return out.slice(0, 5);
  });
  console.log('Open nodes:', JSON.stringify(opens, null, 1).slice(0, 1200));

  // click the parent of first Open node
  if (opens.length) {
    await page.evaluate(() => {
      const walk = (n) => {
        if (n.nodeType === 3 && n.textContent.trim() === 'Open') { n.parentElement.click(); return true; }
        for (const c of n.childNodes) if (walk(c)) return true;
        return false;
      };
      walk(document.body);
    });
    await page.waitForTimeout(2500);
    await shot(page, '48f-sealed-opening');
    await page.waitForTimeout(3000);
    await shot(page, '48g-sealed-revealed');
    const txt = await page.evaluate(() => document.body.innerText.slice(0, 1000));
    console.log('reveal txt:', txt.slice(0, 700));
  }

  // Play in Simulator on sealed pool
  await page.goto('https://riftatlas.com/sealed?format=mix-unl3-ven3&seed=s.kq2drp', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(4000);
  const play = page.getByRole('button', { name: /play in simulator/i }).first();
  if (await play.count()) {
    console.log('play in simulator disabled?', await play.isDisabled(), 'title:', await play.getAttribute('title'));
    await play.click({ timeout: 5000 }).catch((e) => console.log('click err:', e.message.slice(0, 80)));
    await page.waitForTimeout(3500);
    await shot(page, '48h-sealed-play-click');
    const st = await page.evaluate(() => ({ url: location.href, dlg: document.querySelector('dialog[open]') ? document.querySelector('dialog[open]').innerText.slice(0, 300) : null }));
    console.log('after play click:', JSON.stringify(st).slice(0, 500));
  }
  await browser.close();
})().catch((e) => { console.error('FATAL', e); process.exit(1); });
