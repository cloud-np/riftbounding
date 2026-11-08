// Click Share on deck detail page
const { launch, shot, saveJSON, dumpDOM } = require('./lib');

(async () => {
  const { browser, context, page } = await launch();
  await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: 'https://riftatlas.com' }).catch(() => {});
  await page.goto('https://riftatlas.com/decks/community/jh799bw9vxekd68b9vf6hz0zh18fwjc3', { waitUntil: 'domcontentloaded', timeout: 60000 });
  try { await page.waitForLoadState('networkidle', { timeout: 30000 }); } catch {}
  await page.waitForTimeout(4000);

  await page.locator('button[aria-label^="Share" i], button:has(svg.lucide-share), button:has-text("Share")').first().click();
  await page.waitForTimeout(2000);
  await shot(page, '23-share-modal');
  await dumpDOM(page, '[role=dialog]', '23-share-dom', 2);
  const t = await page.evaluate(() => { const d = document.querySelector('[role=dialog]'); return d ? d.innerText : document.body.innerText.slice(-1500); });
  console.log('--- share modal text ---');
  console.log(t);

  await browser.close();
})().catch((e) => { console.error('FATAL', e); process.exit(1); });
