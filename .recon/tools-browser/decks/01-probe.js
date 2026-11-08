// Probe /decks/new: structure, controls, network, chunks. Read-only.
const { launch, shot, saveJSON, OUT } = require('../lib');
const fs = require('fs');
const path = require('path');

(async () => {
  const { browser, page, log } = await launch();
  await page.goto('https://riftatlas.com/decks/new', { waitUntil: 'domcontentloaded', timeout: 90000 });
  try { await page.waitForLoadState('networkidle', { timeout: 45000 }); } catch {}
  await page.waitForTimeout(3500);

  const info = await page.evaluate(() => {
    const txt = (el) => (el.innerText || el.textContent || '').trim().replace(/\s+/g, ' ');
    const controls = [...document.querySelectorAll('button,a[role=button],input,select,textarea,[role=tab],[role=button]')]
      .map((e) => ({
        tag: e.tagName, type: e.getAttribute('type'), id: e.id || null,
        testid: e.getAttribute('data-testid'), aria: e.getAttribute('aria-label'),
        text: txt(e).slice(0, 80), cls: String(e.className || '').slice(0, 140),
        disabled: !!e.disabled, placeholder: e.getAttribute('placeholder'),
      })).filter((c) => c.text || c.placeholder || c.aria || c.testid);
    const testids = [...new Set([...document.querySelectorAll('[data-testid]')].map((e) => e.getAttribute('data-testid')))];
    const dialogs = [...document.querySelectorAll('dialog')].map((d) => ({ open: d.open, label: d.getAttribute('aria-label'), cls: String(d.className).slice(0, 100) }));
    return {
      title: document.title,
      h1: [...document.querySelectorAll('h1,h2,h3')].map((e) => e.tagName + ':' + txt(e).slice(0, 80)).slice(0, 20),
      bodyText: txt(document.body).slice(0, 3500),
      controls, testids, dialogs,
      url: location.href,
    };
  });
  saveJSON('decks/01-probe', info);

  const reqs = log.network.filter((r) => r.kind === 'req');
  const api = reqs.filter((r) => /\/api\/|convex|riftatlas-workers/.test(r.url)).map((r) => ({ m: r.method, u: r.url.slice(0, 220), t: r.type }));
  const chunks = [...new Set(reqs.map((r) => r.url).filter((u) => /_next\/static.*\.(js|css)/.test(u)))];
  saveJSON('decks/01-chunks', chunks);
  saveJSON('decks/01-network', reqs.map((r) => ({ m: r.method, u: r.url.slice(0, 300), t: r.type })));

  const html = await page.content();
  fs.writeFileSync(path.join(OUT, 'decks', 'decks-new.rendered.html'), html);

  console.log('TITLE:', info.title);
  console.log('URL:', info.url);
  console.log('HEADINGS:', info.h1.join(' | '));
  console.log('TEXT:', info.bodyText.slice(0, 1200));
  console.log('TESTIDS:', info.testids.join(', ').slice(0, 1200));
  console.log('CONTROL COUNT:', info.controls.length);
  console.log('DIALOGS:', JSON.stringify(info.dialogs));
  console.log('API:', JSON.stringify(api).slice(0, 2000));
  console.log('CHUNK COUNT:', chunks.length);
  console.log('HTML bytes:', html.length);
  await shot(page, 'decks/01-empty-1920', true);
  await browser.close();
})().catch((e) => { console.error('FATAL', e.message); process.exit(1); });
