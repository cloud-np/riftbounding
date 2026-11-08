// Capture validation panel, save/import/export/guide gates. Read-only.
const { launch, shot, saveJSON } = require('../lib');
const fs = require('fs');
const path = require('path');
const O = (n, d) => fs.writeFileSync(path.resolve(__dirname, '../../browser/decks', n), typeof d === 'string' ? d : JSON.stringify(d, null, 2));

(async () => {
  const { browser, page } = await launch();
  await page.goto('https://riftatlas.com/decks/new', { waitUntil: 'domcontentloaded', timeout: 90000 });
  try { await page.waitForLoadState('networkidle', { timeout: 45000 }); } catch {}
  await page.waitForTimeout(2500);

  const visibleText = (sel) => page.evaluate((s) => {
    const e = document.querySelector(s);
    return e ? (e.innerText || '').replace(/\s+/g, ' ').trim() : null;
  }, sel);

  // issues popover
  await page.locator('button:has-text("issues")').first().click();
  await page.waitForTimeout(800);
  const issues = await page.evaluate(() => {
    const cands = [...document.querySelectorAll('[role=dialog],[data-radix-popper-content-wrapper],[data-state=open]')].filter((e) => (e.innerText || '').trim());
    return cands.map((e) => ({ text: (e.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 3000), html: e.outerHTML.slice(0, 30000) }));
  });
  O('issues-popover.json', issues);
  console.log('ISSUES:', issues.map((x) => x.text).join('\n'));
  await shot(page, 'decks/06-issues-1920');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);

  // save gate
  await page.getByRole('button', { name: 'Save', exact: true }).click({ force: true }).catch((e) => console.log('save click fail', e.message.slice(0, 100)));
  await page.waitForTimeout(1200);
  const saveDlg = await page.evaluate(() => {
    const ds = [...document.querySelectorAll('dialog')].filter((d) => d.open || d.getAttribute('aria-modal') === 'true');
    return ds.map((d) => ({ label: d.getAttribute('aria-label'), text: (d.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 1500), html: d.outerHTML.slice(0, 20000) }));
  });
  O('save-dialog.json', saveDlg);
  console.log('SAVE DIALOGS:', saveDlg.length, saveDlg.map((d) => d.text.slice(0, 500)));
  await shot(page, 'decks/07-save-gate-1920');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(500);

  // Add legend so export works? Export probably needs cards. Add Ahri
  await page.locator('button[aria-label="Add Ahri, Nine-Tailed Fox to the selected deck section"]').first().click({ force: true });
  await page.waitForTimeout(500);
  // export dropdown
  const exp = page.locator('button[aria-label="Export deck"]');
  console.log('export disabled:', await exp.isDisabled());
  await exp.click({ force: true }).catch((e) => console.log('export click fail', e.message.slice(0, 100)));
  await page.waitForTimeout(800);
  const expPop = await page.evaluate(() => [...document.querySelectorAll('[role=dialog],[role=menu],[data-radix-popper-content-wrapper],[data-state=open]')].filter((e) => (e.innerText || '').trim()).map((e) => ({ text: (e.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 1200), html: e.outerHTML.slice(0, 12000) })));
  O('export-popover.json', expPop);
  console.log('EXPORT POPOVER:', expPop.map((x) => x.text).join(' || '));
  await shot(page, 'decks/08-export-popover-1920');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);

  // import dialog
  await page.getByRole('button', { name: 'Import deck', exact: true }).click({ force: true }).catch((e) => console.log('import click fail', e.message.slice(0, 100)));
  await page.waitForTimeout(900);
  const impDlg = await page.evaluate(() => [...document.querySelectorAll('[role=dialog],dialog[open]')].filter((e) => (e.innerText || '').trim()).map((e) => ({ tag: e.tagName, label: e.getAttribute('aria-label'), text: (e.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 2000), html: e.outerHTML.slice(0, 20000) })));
  O('import-dialog.json', impDlg);
  console.log('IMPORT DIALOG:', impDlg.map((x) => x.text).join(' || ').slice(0, 1200));
  await shot(page, 'decks/09-import-dialog-1920');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);

  // guide
  await page.getByRole('button', { name: 'Guide', exact: true }).click({ force: true }).catch((e) => console.log('guide click fail', e.message.slice(0, 100)));
  await page.waitForTimeout(900);
  const guide = await page.evaluate(() => [...document.querySelectorAll('[role=dialog],dialog[open]')].filter((e) => (e.innerText || '').trim()).map((e) => ({ text: (e.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 2500), html: e.outerHTML.slice(0, 30000) })));
  O('guide-dialog.json', guide);
  console.log('GUIDE:', guide.map((x) => x.text).join(' || ').slice(0, 1500));
  await shot(page, 'decks/10-guide-1920');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);

  // discard draft
  await page.getByRole('button', { name: /Discard Draft/i }).click({ force: true }).catch((e) => console.log('discard click fail', e.message.slice(0, 100)));
  await page.waitForTimeout(900);
  const disc = await page.evaluate(() => [...document.querySelectorAll('[role=dialog],dialog[open]')].filter((e) => (e.innerText || '').trim()).map((e) => ({ text: (e.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 1200), html: e.outerHTML.slice(0, 12000) })));
  O('discard-dialog.json', disc);
  console.log('DISCARD:', disc.map((x) => x.text).join(' || ').slice(0, 800));
  await shot(page, 'decks/11-discard-dialog-1920');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);

  await browser.close();
})().catch((e) => { console.error('FATAL', e.stack?.slice(0, 1200)); process.exit(1); });
