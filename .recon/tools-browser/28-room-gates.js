// Probe every room entry point: HOST, JOIN, FIND RANDOM MATCH. Check gate + toasts.
const { launch, shot, saveJSON } = require('./lib');
const fs = require('fs');
const path = require('path');

const deck = JSON.parse(fs.readFileSync(path.resolve(__dirname, '..', 'browser', '24-riven-deck.json'), 'utf8'));
function buildDeckText() {
  const line = (c) => `${parseInt(c.count, 10)} ${c.title}`;
  const p = [];
  p.push('Legend:'); deck.LEGEND.forEach((c) => p.push(line(c)));
  p.push('', 'Champion:'); deck.CHAMPION.forEach((c) => p.push(line(c)));
  p.push('', 'Main Deck:'); deck['MAIN DECK'].forEach((c) => p.push(line(c)));
  p.push('', 'Battlefields:'); deck.BATTLEFIELDS.forEach((c) => p.push(line(c)));
  p.push('', 'Runes:'); deck.RUNES.forEach((c) => p.push(line(c)));
  p.push('', 'Sideboard:'); deck.SIDEBOARD.forEach((c) => p.push(line(c)));
  return p.join('\n');
}

async function state(page) {
  return page.evaluate(() => {
    const dlg = document.querySelector('dialog[open]');
    const toasts = [...document.querySelectorAll('[role=alert], [role=status]')].map((e) => e.innerText.slice(0, 200)).filter(Boolean);
    return { url: location.href, dialogOpen: !!dlg, dialogText: dlg ? dlg.innerText.replace(/\n+/g, ' | ').slice(0, 400) : null, toasts, bodyTail: document.body.innerText.slice(-400).replace(/\n+/g, ' | ') };
  });
}

(async () => {
  const { browser, page, log } = await launch();
  const results = {};
  await page.goto('https://play.riftatlas.com/', { waitUntil: 'domcontentloaded', timeout: 60000 });
  try { await page.waitForLoadState('networkidle', { timeout: 30000 }); } catch {}
  await page.waitForTimeout(3000);
  await page.locator('#right-rail-player-name').fill('ReconBot');
  await page.getByRole('button', { name: /import deck/i }).click();
  await page.waitForTimeout(800);
  await page.locator('textarea').first().fill(buildDeckText());
  await page.waitForTimeout(1500);
  await page.getByRole('dialog').getByRole('button', { name: /^import deck$/i }).click();
  await page.waitForTimeout(2000);

  const tryAction = async (label, fn, shotName) => {
    await fn();
    await page.waitForTimeout(3000);
    results[label] = await state(page);
    console.log(label, '->', JSON.stringify(results[label]).slice(0, 500));
    if (shotName) await shot(page, shotName);
    // close any dialog
    const close = page.locator('dialog[open] button[aria-label="Close"]');
    if (await close.count()) { await close.first().click(); await page.waitForTimeout(800); }
  };

  await tryAction('SOLO ROOM', () => page.getByRole('button', { name: /solo room/i }).click(), '28a-solo-gate');
  await tryAction('HOST ROOM', () => page.getByRole('button', { name: /host room/i }).click(), '28b-host-gate');
  await tryAction('JOIN bad code', async () => { await page.locator('#join-code').fill('ABC123'); await page.getByRole('button', { name: /join \/ spectate/i }).click(); }, '28c-join-gate');
  await tryAction('FIND RANDOM MATCH', () => page.getByRole('button', { name: /find random match/i }).click(), '28d-quickmatch-gate');

  saveJSON('28-room-gates', results);

  // try direct board URLs
  for (const u of ['https://play.riftatlas.com/room/ABC123', 'https://play.riftatlas.com/game', 'https://play.riftatlas.com/table']) {
    const resp = await page.goto(u, { waitUntil: 'domcontentloaded', timeout: 30000 }).catch((e) => null);
    await page.waitForTimeout(2500);
    const info = await page.evaluate(() => ({ title: document.title, h: document.body.innerText.slice(0, 200).replace(/\n+/g, ' | ') }));
    console.log('URL', u, '->', resp ? resp.status() : 'ERR', JSON.stringify(info).slice(0, 300));
  }
  await browser.close();
})().catch((e) => { console.error('FATAL', e); process.exit(1); });
