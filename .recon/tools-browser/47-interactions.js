// Board preview interactions + sealed pack reveal + mobile customize phone preview
const { launch, shot, saveJSON } = require('./lib');

(async () => {
  const { browser, page } = await launch();

  // ---- board preview interactions ----
  await page.goto('https://play.riftatlas.com/customize', { waitUntil: 'domcontentloaded', timeout: 60000 });
  try { await page.waitForLoadState('networkidle', { timeout: 30000 }); } catch {}
  await page.waitForTimeout(3000);
  await page.getByRole('button', { name: /view full board/i }).first().click();
  await page.waitForTimeout(5000);

  // click a card on the board (the visible card face at left battlefield, ~x455 y545 in 1920 space)
  const spots = [
    { name: 'card-on-battlefield', x: 498, y: 545 },
    { name: 'battlefield-card', x: 1170, y: 530 },
    { name: 'unit-bottom', x: 1038, y: 810 },
    { name: 'deck-opponent', x: 210, y: 145 },
    { name: 'rune-deck', x: 1450, y: 1000 },
    { name: 'plus-left-bf', x: 860, y: 745 },
  ];
  for (const s of spots) {
    await page.mouse.click(s.x, s.y);
    await page.waitForTimeout(1200);
    await shot(page, `47-preview-click-${s.name}`);
  }
  // right-click on a card
  await page.mouse.click(498, 545, { button: 'right' });
  await page.waitForTimeout(1200);
  await shot(page, '47-preview-rightclick-card');
  const ctx = await page.evaluate(() => {
    const menus = [...document.querySelectorAll('[role=menu], [class*=context], [class*=menu]')].filter((m) => m.offsetWidth > 50);
    return menus.map((m) => ({ cls: String(m.className).slice(0, 100), txt: (m.innerText || '').slice(0, 300) }));
  });
  console.log('context menus:', JSON.stringify(ctx).slice(0, 800));
  await page.keyboard.press('Escape');

  // MAIN PHASE button
  const mp = page.getByRole('button', { name: /main phase/i }).first();
  if (await mp.count()) { await mp.click().catch(() => {}); await page.waitForTimeout(1200); await shot(page, '47-preview-main-phase'); }

  await browser.close();

  // ---- sealed pack reveal ----
  const { browser: b2, page: p2 } = await launch();
  await p2.goto('https://riftatlas.com/sealed?format=mix-unl3-ven3&seed=s.kq2drp', { waitUntil: 'domcontentloaded', timeout: 60000 });
  try { await p2.waitForLoadState('networkidle', { timeout: 30000 }); } catch {}
  await p2.waitForTimeout(4000);
  const open = p2.getByRole('button', { name: /^open$/i }).first();
  console.log('open buttons:', await p2.getByRole('button', { name: /^open$/i }).count());
  await open.click().catch((e) => console.log('open fail', e.message.slice(0, 60)));
  await p2.waitForTimeout(4000);
  await shot(p2, '48-sealed-pack-reveal');
  // click through cards or continue
  const cont = p2.getByRole('button', { name: /continue|next|done|collect/i }).first();
  if (await cont.count()) { await cont.click().catch(() => {}); await p2.waitForTimeout(2500); await shot(p2, '48b-sealed-after-continue'); }
  const t = await p2.evaluate(() => document.body.innerText.slice(0, 1800));
  console.log('SEALED REVEAL TXT:', t.slice(0, 1200));

  // ---- mobile customize with phone preview ----
  await p2.close();
  const ctx2 = await b2.newContext({ viewport: { width: 390, height: 844 } });
  const p3 = await ctx2.newPage();
  await p3.goto('https://play.riftatlas.com/customize', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await p3.waitForTimeout(4000);
  const phone = p3.getByRole('button', { name: /^phone$/i }).first();
  if (await phone.count()) { await phone.click().catch(() => {}); await p3.waitForTimeout(1500); }
  await shot(p3, '48c-mobile-customize-phone-preview', true);
  await b2.close();
})().catch((e) => { console.error('FATAL', e); process.exit(1); });
