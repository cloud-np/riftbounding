// Probe mobile drawer + guide + discard + max-copy tooltip.
const { launch, shot } = require('../lib');

(async () => {
  const { browser, page } = await launch();
  await page.goto('https://riftatlas.com/decks/new', { waitUntil: 'domcontentloaded', timeout: 90000 });
  try { await page.waitForLoadState('networkidle', { timeout: 45000 }); } catch {}
  await page.waitForTimeout(2500);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(800);

  const btn = page.locator('[data-testid=mobile-deck-drawer-toggle]');
  console.log('drawer toggle count', await btn.count(), 'text', await btn.innerText().catch(() => ''));
  await btn.first().click({ force: true });
  await page.waitForTimeout(800);
  const st = await page.evaluate(() => {
    const cands = [...document.querySelectorAll('[data-testid=mobile-deck-workspace-panel],[role=dialog]')].filter((e) => e.offsetParent !== null);
    return cands.map((e) => ({ testid: e.getAttribute('data-testid'), role: e.getAttribute('role'), text: (e.innerText || '').replace(/\s+/g, ' ').slice(0, 900), cls: String(e.className).slice(0, 160) }));
  });
  console.log(JSON.stringify(st).slice(0, 2200));
  await shot(page, 'decks/probe-390-drawer');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(400);

  // desktop interactions
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.waitForTimeout(800);
  const guide = page.locator('button').filter({ hasText: /^Guide$/ }).first();
  console.log('guide count', await guide.count());
  await guide.click({ force: true });
  await page.waitForTimeout(700);
  const gd = await page.evaluate(() => [...document.querySelectorAll('[role=dialog],dialog[open],[data-radix-popper-content-wrapper]')].filter((e) => e.offsetParent !== null).map((e) => ({ text: (e.innerText || '').replace(/\s+/g, ' ').slice(0, 900), html: e.outerHTML.slice(0, 4000) })));
  console.log('GUIDE:', JSON.stringify(gd).slice(0, 1500));
  await shot(page, 'decks/probe-guide');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);

  // partial deck issues
  await page.locator('button[aria-label="Add Ahri, Nine-Tailed Fox to the selected deck section"]').first().click({ force: true });
  await page.waitForTimeout(500);
  const issueBtn = page.locator('button:has-text("issues")').first();
  console.log('issues text', await issueBtn.innerText());
  await issueBtn.click({ force: true });
  await page.waitForTimeout(600);
  const ip = await page.evaluate(() => {
    const all = [...document.querySelectorAll('section,p,div')].filter((e) => {
      const t = e.innerText || '';
      return /Missing required section/.test(t) && t.length < 1500;
    });
    return all.map((e) => ({ tag: e.tagName, text: (e.innerText || '').replace(/\s+/g, ' ').slice(0, 1200), cls: String(e.className).slice(0, 120) }));
  });
  console.log('ISSUES PANEL:', JSON.stringify(ip).slice(0, 1600));
  await shot(page, 'decks/probe-issues');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);

  // discard
  const disc = page.locator('button').filter({ hasText: /Discard Draft/i }).first();
  console.log('discard count', await disc.count());
  await disc.click({ force: true });
  await page.waitForTimeout(600);
  const dd = await page.evaluate(() => [...document.querySelectorAll('[role=dialog],dialog[open]')].filter((e) => e.offsetParent !== null).map((e) => ({ text: (e.innerText || '').replace(/\s+/g, ' ').slice(0, 900) })));
  console.log('DISCARD:', JSON.stringify(dd).slice(0, 1000));
  await shot(page, 'decks/probe-discard');
  await browser.close();
})().catch((e) => { console.error('FATAL', e.stack?.slice(0, 1200)); process.exit(1); });
