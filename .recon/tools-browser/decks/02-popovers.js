// Open builder popovers/dialogs, capture DOM + screenshots. Read-only.
const { launch, shot, saveJSON } = require('../lib');
const fs = require('fs');
const path = require('path');

const o = (name, data) => fs.writeFileSync(path.resolve(__dirname, '../../browser/decks', name), typeof data === 'string' ? data : JSON.stringify(data, null, 2));

(async () => {
  const { browser, page } = await launch();
  await page.goto('https://riftatlas.com/decks/new', { waitUntil: 'domcontentloaded', timeout: 90000 });
  try { await page.waitForLoadState('networkidle', { timeout: 45000 }); } catch {}
  await page.waitForTimeout(2500);

  // Filter popover
  const filterBtn = page.locator('button[aria-label="Filter cards"]').first();
  await filterBtn.click({ timeout: 10000 });
  await page.waitForTimeout(800);
  let pop = await page.evaluate(() => {
    const cands = [...document.querySelectorAll('[data-radix-popper-content-wrapper],[role=dialog],[role=menu],[data-state=open]')];
    return cands.map((e) => ({ tag: e.tagName, role: e.getAttribute('role'), state: e.getAttribute('data-state'), text: (e.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 600), html: e.outerHTML.slice(0, 12000) })).filter((x) => x.text);
  });
  o('filter-popover.json', pop);
  console.log('FILTER POPOVERS:', pop.length);
  pop.forEach((p, i) => console.log(i, p.tag, p.role, '|', p.text.slice(0, 500)));
  await shot(page, 'decks/02-filter-popover-1920');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(400);

  // View popover
  const viewBtn = page.locator('[data-testid=deckbuilder-catalog-view-options]');
  await viewBtn.click({ timeout: 10000 });
  await page.waitForTimeout(800);
  pop = await page.evaluate(() => {
    const cands = [...document.querySelectorAll('[data-radix-popper-content-wrapper],[role=dialog],[role=menu],[data-state=open]')];
    return cands.map((e) => ({ tag: e.tagName, role: e.getAttribute('role'), state: e.getAttribute('data-state'), text: (e.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 600), html: e.outerHTML.slice(0, 12000) })).filter((x) => x.text);
  });
  o('view-popover.json', pop);
  console.log('VIEW POPOVERS:', pop.length);
  pop.forEach((p, i) => console.log(i, p.tag, p.role, '|', p.text.slice(0, 500)));
  await shot(page, 'decks/03-view-popover-1920');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(400);

  // card detail: click "View details for Ahri..."
  const detail = page.locator('button[aria-label^="View details for Ahri"]').first();
  await detail.click({ timeout: 10000, force: true });
  await page.waitForTimeout(1200);
  const dlg = await page.evaluate(() => {
    const d = [...document.querySelectorAll('dialog[open],[role=dialog]')].filter((e) => e.offsetParent !== null || e.tagName === 'DIALOG');
    return d.map((e) => ({ tag: e.tagName, label: e.getAttribute('aria-label'), cls: String(e.className).slice(0, 160), text: (e.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 1500), html: e.outerHTML.slice(0, 30000) }));
  });
  o('card-detail.json', dlg);
  console.log('DETAIL DIALOGS:', dlg.length);
  dlg.forEach((d, i) => console.log(i, d.tag, d.label, '|', d.text.slice(0, 700)));
  await shot(page, 'decks/04-card-detail-1920');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(500);

  // hover card
  const cardImg = page.locator('[data-testid=deckbuilder-catalog-grid] img').first();
  await cardImg.hover();
  await page.waitForTimeout(1200);
  await shot(page, 'decks/05-card-hover-1920');
  const hoverText = await page.evaluate(() => {
    const els = [...document.querySelectorAll('body *')].filter((e) => {
      const s = getComputedStyle(e);
      return (s.position === 'fixed' || s.position === 'absolute') && s.visibility !== 'hidden' && e.getBoundingClientRect().width > 200 && /PREVIEW|View details|Add to/i.test(e.innerText || '');
    });
    return els.slice(0, 4).map((e) => (e.innerText || '').replace(/\s+/g, ' ').slice(0, 500));
  });
  console.log('HOVER LAYERS:', JSON.stringify(hoverText));

  // add by clicking card image? check first card add button
  await browser.close();
})().catch((e) => { console.error('FATAL', e.stack?.slice(0, 1000)); process.exit(1); });
