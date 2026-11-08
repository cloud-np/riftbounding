// Import deck, then try SOLO ROOM
const { launch, shot, saveJSON, dumpDOM } = require('./lib');
const fs = require('fs');
const path = require('path');

const deck = JSON.parse(fs.readFileSync(path.resolve(__dirname, '..', 'browser', '24-riven-deck.json'), 'utf8'));
function buildDeckText() {
  const line = (c) => `${parseInt(c.count, 10)} ${c.title}`;
  const parts = [];
  parts.push('Legend:'); deck.LEGEND.forEach((c) => parts.push(line(c)));
  parts.push(''); parts.push('Champion:'); deck.CHAMPION.forEach((c) => parts.push(line(c)));
  parts.push(''); parts.push('Main Deck:'); deck['MAIN DECK'].forEach((c) => parts.push(line(c)));
  parts.push(''); parts.push('Battlefields:'); deck.BATTLEFIELDS.forEach((c) => parts.push(line(c)));
  parts.push(''); parts.push('Runes:'); deck.RUNES.forEach((c) => parts.push(line(c)));
  parts.push(''); parts.push('Sideboard:'); deck.SIDEBOARD.forEach((c) => parts.push(line(c)));
  return parts.join('\n');
}

(async () => {
  const { browser, page, log } = await launch();
  await page.goto('https://play.riftatlas.com/', { waitUntil: 'domcontentloaded', timeout: 60000 });
  try { await page.waitForLoadState('networkidle', { timeout: 30000 }); } catch {}
  await page.waitForTimeout(3000);

  // fill player name
  const nameInput = page.locator('#right-rail-player-name');
  if (await nameInput.count()) { await nameInput.fill('ReconBot'); }

  // import deck
  await page.getByRole('button', { name: /import deck/i }).click();
  await page.waitForTimeout(1000);
  await page.locator('textarea').first().fill(buildDeckText());
  await page.waitForTimeout(2000);
  await page.getByRole('dialog').getByRole('button', { name: /^import deck$/i }).click();
  await page.waitForTimeout(2500);
  await shot(page, '26-lobby-deck-imported');
  const lobbyText = await page.evaluate(() => document.body.innerText.slice(0, 2500));
  console.log('--- lobby after import ---');
  console.log(lobbyText.slice(0, 1800));

  // SOLO ROOM
  await page.getByRole('button', { name: /solo room/i }).click();
  await page.waitForTimeout(4000);
  console.log('url after solo:', page.url());
  await shot(page, '27-solo-room-after-import');
  const txt = await page.evaluate(() => document.body.innerText.slice(0, 3000));
  console.log('--- text after solo ---');
  console.log(txt.slice(0, 2200));

  saveJSON('26-import-solo-network', log.network.filter((n) => n.kind === 'req').map((n) => ({ m: n.method, u: n.url.slice(0, 200), t: n.type, post: n.post && n.post.slice(0, 400) })));
  saveJSON('26-import-solo-ws', log.ws);
  const html = await page.content();
  fs.writeFileSync(path.resolve(__dirname, '..', 'browser', '27-solo-room.rendered.html'), html);
  console.log('ws count:', log.ws.length);
  await browser.close();
})().catch((e) => { console.error('FATAL', e); process.exit(1); });
