// 1) Customize "View full board"  2) Sealed pack opening  3) decks/new Play in Simulator
const { launch, shot, saveJSON, dumpDOM } = require('./lib');
const fs = require('fs');
const path = require('path');

(async () => {
  const { browser, page, log } = await launch();
  const results = {};

  // 1. Customize -> View full board
  await page.goto('https://play.riftatlas.com/customize', { waitUntil: 'domcontentloaded', timeout: 60000 });
  try { await page.waitForLoadState('networkidle', { timeout: 30000 }); } catch {}
  await page.waitForTimeout(3500);
  const vfb = page.getByRole('link', { name: /view full board/i }).or(page.getByRole('button', { name: /view full board/i })).first();
  const vfbCount = await vfb.count();
  console.log('view full board count:', vfbCount);
  if (vfbCount) {
    const href = await vfb.getAttribute('href').catch(() => null);
    console.log('vfb href:', href);
    await vfb.click();
    await page.waitForTimeout(5000);
    console.log('url after vfb:', page.url());
    await shot(page, '41-customize-full-board');
    const t = await page.evaluate(() => ({ title: document.title, txt: document.body.innerText.slice(0, 1500) }));
    results.fullBoard = t;
    console.log('FULL BOARD:', JSON.stringify(t).slice(0, 1200));
  }

  // 2. Sealed: open the 6-pack pool
  await page.goto('https://riftatlas.com/sealed', { waitUntil: 'domcontentloaded', timeout: 60000 });
  try { await page.waitForLoadState('networkidle', { timeout: 30000 }); } catch {}
  await page.waitForTimeout(3500);
  await shot(page, '42-sealed-start');
  const openBtn = page.getByRole('button', { name: /open packs/i }).first();
  console.log('open packs count:', await openBtn.count());
  await openBtn.click();
  await page.waitForTimeout(6000);
  await shot(page, '43-sealed-after-open');
  const sealedTxt = await page.evaluate(() => ({ url: location.href, txt: document.body.innerText.slice(0, 2500) }));
  results.sealed = sealedTxt;
  console.log('SEALED AFTER:', JSON.stringify(sealedTxt).slice(0, 2000));
  saveJSON('42-sealed-state', results);

  // 3. decks/new -> Play in Simulator
  await page.goto('https://riftatlas.com/decks/new', { waitUntil: 'domcontentloaded', timeout: 60000 });
  try { await page.waitForLoadState('networkidle', { timeout: 30000 }); } catch {}
  await page.waitForTimeout(4000);
  const playBtn = page.getByRole('button', { name: /play in simulator/i }).first();
  console.log('play in sim count:', await playBtn.count());
  if (await playBtn.count()) {
    await playBtn.click();
    await page.waitForTimeout(4000);
    await shot(page, '44-decks-new-play-click');
    console.log('url after play in sim:', page.url());
    const t2 = await page.evaluate(() => ({ url: location.href, dialog: !!document.querySelector('dialog[open]'), txt: (document.querySelector('dialog[open]') || document.body).innerText.slice(0, 600) }));
    console.log('PLAY IN SIM:', JSON.stringify(t2).slice(0, 700));
  }
  await browser.close();
})().catch((e) => { console.error('FATAL', e); process.exit(1); });
