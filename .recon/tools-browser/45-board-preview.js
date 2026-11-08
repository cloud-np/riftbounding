// Deep capture of the read-only board preview on /customize
const { launch, shot, saveJSON, dumpDOM } = require('./lib');
const fs = require('fs');
const path = require('path');

(async () => {
  const { browser, page } = await launch();
  await page.goto('https://play.riftatlas.com/customize', { waitUntil: 'domcontentloaded', timeout: 60000 });
  try { await page.waitForLoadState('networkidle', { timeout: 30000 }); } catch {}
  await page.waitForTimeout(3500);

  const vfb = page.getByRole('button', { name: /view full board/i }).or(page.getByRole('link', { name: /view full board/i })).first();
  await vfb.click();
  await page.waitForTimeout(6000);
  await shot(page, '45-board-preview-full', true);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(1000);
  await shot(page, '45-board-preview-top');

  // find the board container and dump it
  const boardSel = await page.evaluate(() => {
    // heuristics: element containing "PLAY FROM HIDDEN" and "TOKEN PANEL"
    const cands = [...document.querySelectorAll('div,section')].filter((d) => /PLAY FROM HIDDEN/.test(d.innerText || '') && /TOKEN PANEL/.test(d.innerText || '') && d.querySelectorAll('*').length < 4000);
    if (!cands.length) return null;
    cands.sort((a, b) => a.querySelectorAll('*').length - b.querySelectorAll('*').length);
    const el = cands[0];
    el.setAttribute('data-recon-board', '1');
    const r = el.getBoundingClientRect();
    return { cls: String(el.className), rect: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) } };
  });
  console.log('board container:', JSON.stringify(boardSel));
  if (boardSel) {
    const html = await page.evaluate(() => document.querySelector('[data-recon-board]').outerHTML);
    fs.writeFileSync(path.resolve(__dirname, '..', 'browser', '45-board-preview-dom.html'), html);
    console.log('board DOM chars:', html.length);
  }

  // all buttons in the preview area with labels
  const btns = await page.evaluate(() => [...document.querySelectorAll('button, [role=button]')].map((b) => { const r = b.getBoundingClientRect(); return { t: (b.innerText || b.getAttribute('aria-label') || b.title || '').trim().slice(0, 60), cls: String(b.className).slice(0, 90), rect: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) } }; }).filter((b) => b.rect.w > 0));
  saveJSON('45-board-preview-buttons', btns);
  console.log('buttons:', btns.length);

  // Try Phone preview + screenshots of the 3 layout modes
  for (const mode of ['Phone', 'Tablet', 'Desktop']) {
    const b = page.getByRole('button', { name: new RegExp('^' + mode + '$', 'i') }).first();
    if (await b.count()) {
      await b.click().catch(() => {});
      await page.waitForTimeout(1800);
      await shot(page, `45-preview-${mode.toLowerCase()}`);
    }
  }

  // click a couple of read-only controls to see behavior
  for (const label of ['TOKEN PANEL', 'PLAY FROM HIDDEN', 'REVEAL TO OPPONENT']) {
    const b = page.getByRole('button', { name: new RegExp(label, 'i') }).first();
    if (await b.count()) {
      await b.click({ timeout: 4000 }).catch((e) => console.log('click fail', label, e.message.slice(0, 80)));
      await page.waitForTimeout(1500);
      await shot(page, `46-preview-click-${label.toLowerCase().replace(/\s+/g, '-')}`);
    }
  }

  await browser.close();
})().catch((e) => { console.error('FATAL', e); process.exit(1); });
