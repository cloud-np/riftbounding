// Public deck detail, /decks, /decks/mine with local draft, edit-route shell.
const { launch, shot } = require('../lib');
const fs = require('fs');
const path = require('path');
const O = (n, d) => fs.writeFileSync(path.resolve(__dirname, '../../browser/decks', n), typeof d === 'string' ? d : JSON.stringify(d, null, 2));

(async () => {
  const { browser, context, page } = await launch();
  const url = 'https://riftatlas.com/decks/community/jh799bw9vxekd68b9vf6hz0zh18fwjc3';

  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 90000 });
  try { await page.waitForLoadState('networkidle', { timeout: 30000 }); } catch {}
  await page.waitForTimeout(2500);
  const btns = await page.evaluate(() => [...document.querySelectorAll('button,a[role=button]')].map((b) => ({ t: (b.innerText || b.getAttribute('aria-label') || '').replace(/\s+/g, ' ').slice(0, 60), aria: b.getAttribute('aria-label'), testid: b.getAttribute('data-testid'), cls: String(b.className).slice(0, 100) })).filter((b) => b.t));
  O('32-deck-detail-buttons.json', btns);
  console.log('BUTTONS:', btns.map((b) => b.t).join(' | ').slice(0, 1200));
  const text = await page.evaluate(() => (document.body.innerText || '').replace(/\s+/g, ' ').slice(0, 2500));
  console.log('TEXT:', text);
  await shot(page, 'decks/32-deck-detail-1920', true);

  // stats tab
  const stats = page.getByText('Stats', { exact: true }).first();
  if (await stats.count()) {
    await stats.click({ force: true });
    await page.waitForTimeout(800);
    await shot(page, 'decks/33-deck-detail-stats-1920');
  }

  // play gate
  const play = page.getByRole('button', { name: /^Play$/ }).first();
  if (await play.count()) {
    await play.click({ force: true });
    await page.waitForTimeout(1000);
    await shot(page, 'decks/34-deck-detail-play-gate-1920');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(400);
  }

  // save gate
  const save = page.getByRole('button', { name: /Save to my decks/i }).first();
  if (await save.count()) {
    await save.click({ force: true });
    await page.waitForTimeout(1000);
    await shot(page, 'decks/35-deck-detail-save-gate-1920');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(400);
  }

  // mobile deck detail
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(800);
  await page.evaluate(() => window.scrollTo(0, 0));
  await shot(page, 'decks/36-deck-detail-390');

  // /decks
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto('https://riftatlas.com/decks', { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForTimeout(3000);
  await shot(page, 'decks/37-decks-index-1920', true);

  // /decks/mine guest, then with local draft
  await page.goto('https://riftatlas.com/decks/mine', { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForTimeout(2500);
  await shot(page, 'decks/38-mine-guest-1920');
  const draft = fs.readFileSync('/tmp/opencode/riven-draft.json', 'utf8');
  await page.evaluate((d) => localStorage.setItem('riftatlas_deckbuilder_draft_v1', d), draft);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2500);
  const mine = await page.evaluate(() => (document.querySelector('[data-testid=deck-library-page]')?.innerText || document.body.innerText || '').replace(/\s+/g, ' ').slice(0, 2000));
  O('39-mine-draft.json', mine);
  console.log('MINE DRAFT:', mine);
  await shot(page, 'decks/39-mine-draft-1920', true);

  // edit-route shell (guest, fake saved deck id)
  await page.goto('https://riftatlas.com/decks/b26reconfakeid', { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForTimeout(2500);
  const edit = await page.evaluate(() => ({ title: document.title, text: (document.body.innerText || '').replace(/\s+/g, ' ').slice(0, 1200), url: location.href }));
  O('40-edit-route.json', edit);
  console.log('EDIT ROUTE:', JSON.stringify(edit));
  await shot(page, 'decks/40-edit-route-guest-1920');

  await browser.close();
})().catch((e) => { console.error('FATAL', e.stack?.slice(0, 1500)); process.exit(1); });
