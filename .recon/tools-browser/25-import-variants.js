// Test deck import format variants
const { launch, shot, saveJSON } = require('./lib');
const fs = require('fs');
const path = require('path');

const deck = JSON.parse(fs.readFileSync(path.resolve(__dirname, '..', 'browser', '24-riven-deck.json'), 'utf8'));

function buildDeckText(headerStyle, withCodes) {
  const sec = (name) => headerStyle === 'upper' ? name.toUpperCase() : headerStyle === 'title' ? name : name + ':';
  const line = (c) => {
    const n = parseInt(c.count, 10);
    return withCodes && c.code ? `${n} ${c.title} [${c.code}]` : `${n} ${c.title}`;
  };
  const parts = [];
  parts.push(sec('Legend')); deck.LEGEND.forEach((c) => parts.push(line(c)));
  parts.push(''); parts.push(sec('Champion')); deck.CHAMPION.forEach((c) => parts.push(line(c)));
  parts.push(''); parts.push(sec('Main Deck')); deck['MAIN DECK'].forEach((c) => parts.push(line(c)));
  parts.push(''); parts.push(sec('Battlefields')); deck.BATTLEFIELDS.forEach((c) => parts.push(line(c)));
  parts.push(''); parts.push(sec('Runes')); deck.RUNES.forEach((c) => parts.push(line(c)));
  parts.push(''); parts.push(sec('Sideboard')); deck.SIDEBOARD.forEach((c) => parts.push(line(c)));
  return parts.join('\n');
}

(async () => {
  const { browser, page } = await launch();
  await page.goto('https://play.riftatlas.com/', { waitUntil: 'domcontentloaded', timeout: 60000 });
  try { await page.waitForLoadState('networkidle', { timeout: 30000 }); } catch {}
  await page.waitForTimeout(3000);

  const variants = [
    { name: 'upper-nocodes', text: buildDeckText('upper', false) },
    { name: 'title-nocodes', text: buildDeckText('title', false) },
    { name: 'colon-nocodes', text: buildDeckText('colon', false) },
    { name: 'upper-codes', text: buildDeckText('upper', true) },
  ];
  const results = {};
  for (const v of variants) {
    await page.getByRole('button', { name: /import deck/i }).click();
    await page.waitForTimeout(1000);
    const ta = page.locator('textarea').first();
    await ta.fill(v.text);
    await page.waitForTimeout(2000);
    const feedback = await page.evaluate(() => { const d = document.querySelector('[role=dialog]'); return d ? d.innerText.slice(0, 3000) : ''; });
    results[v.name] = feedback;
    await shot(page, `25-import-${v.name}`);
    // close modal
    const cancel = page.getByRole('button', { name: /^cancel$/i }).first();
    await cancel.click().catch(() => {});
    await page.waitForTimeout(800);
  }
  saveJSON('25-import-variants', results);
  for (const [k, v] of Object.entries(results)) {
    console.log('=====', k, '=====');
    console.log(v.slice(0, 1200));
  }
  await browser.close();
})().catch((e) => { console.error('FATAL', e); process.exit(1); });
