// Try SOLO ROOM without a deck; see what the flow offers
const { launch, shot, saveJSON, dumpDOM } = require('./lib');

(async () => {
  const { browser, page, log } = await launch();
  await page.goto('https://play.riftatlas.com/', { waitUntil: 'domcontentloaded', timeout: 60000 });
  try { await page.waitForLoadState('networkidle', { timeout: 30000 }); } catch {}
  await page.waitForTimeout(3000);

  await page.getByRole('button', { name: /solo room/i }).click();
  await page.waitForTimeout(2500);
  console.log('url after SOLO ROOM:', page.url());
  await shot(page, '19-solo-room-no-deck');
  const txt = await page.evaluate(() => document.body.innerText.slice(0, 2500));
  console.log('--- text ---');
  console.log(txt);
  const toast = await page.evaluate(() => [...document.querySelectorAll('[role=alert], [role=status], [class*=toast], [class*=Toast]')].map((e) => e.innerText.slice(0, 300)));
  console.log('toasts:', JSON.stringify(toast));

  // Also try HOST ROOM quickly
  await page.getByRole('button', { name: /host room/i }).click().catch(() => {});
  await page.waitForTimeout(2500);
  console.log('url after HOST ROOM:', page.url());
  await shot(page, '19b-host-room-no-deck');
  const txt2 = await page.evaluate(() => document.body.innerText.slice(0, 2000));
  console.log('--- text2 ---');
  console.log(txt2);

  saveJSON('19-solo-host-no-deck', { log: log.network.filter((n) => n.kind === 'req').map((n) => ({ m: n.method, u: n.url.slice(0, 150) })) });
  await browser.close();
})().catch((e) => { console.error('FATAL', e); process.exit(1); });
