// Probe import modal: USE DECK CODE tab + parser feedback on pasted text
const { launch, shot, dumpDOM, saveJSON } = require('./lib');

(async () => {
  const { browser, page, log } = await launch();
  await page.goto('https://play.riftatlas.com/', { waitUntil: 'domcontentloaded', timeout: 60000 });
  try { await page.waitForLoadState('networkidle', { timeout: 30000 }); } catch {}
  await page.waitForTimeout(3000);

  await page.getByRole('button', { name: /import deck/i }).click();
  await page.waitForTimeout(1500);

  // 1. USE DECK CODE tab
  const codeTab = page.getByText('USE DECK CODE', { exact: false }).first();
  await codeTab.click();
  await page.waitForTimeout(1200);
  await shot(page, '15-use-deck-code-tab');
  await dumpDOM(page, '[role=dialog]', '15-use-deck-code-dom', 1);
  const codeUI = await page.evaluate(() => {
    const dlg = document.querySelector('[role=dialog]');
    return dlg ? { text: dlg.innerText.slice(0, 1500), inputs: [...dlg.querySelectorAll('input, textarea')].map((i) => ({ tag: i.tagName, ph: i.placeholder, name: i.name, id: i.id })) } : null;
  });
  console.log('DECK CODE UI:', JSON.stringify(codeUI, null, 1));

  // 2. back to deck list tab and paste a plausible list
  await page.getByText('DECK LIST', { exact: false }).first().click();
  await page.waitForTimeout(800);
  const ta = page.locator('textarea').first();
  const sample = [
    '1x Ahri, Nine-Tailed Fox',
    '1x Yasuo, the Unforgiven',
    '3x Nimble Poro',
    '39x Poro Snax',
  ].join('\n');
  await ta.fill(sample);
  await page.waitForTimeout(2500);
  await shot(page, '16-import-parser-feedback');
  const feedback = await page.evaluate(() => {
    const dlg = document.querySelector('[role=dialog]');
    return dlg ? dlg.innerText.slice(0, 2500) : null;
  });
  console.log('--- parser feedback ---');
  console.log(feedback);
  saveJSON('16-import-feedback', { feedback });

  await browser.close();
})().catch((e) => { console.error('FATAL', e); process.exit(1); });
