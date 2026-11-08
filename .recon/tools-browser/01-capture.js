// Recon B: initial capture of https://riftatlas.com/play
// Saves: full-page screenshot, rendered DOM, network log, ws log, console log, storage, cookies
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const OUT = path.resolve(__dirname, '..', 'browser');
const SHOTS = path.resolve(__dirname, '..', 'screens');
const URL = 'https://riftatlas.com/play';

(async () => {
  const browser = await chromium.launch({
    executablePath: '/usr/bin/chromium',
    headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
  });
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    deviceScaleFactor: 1,
    userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.0.0 Safari/537.36',
  });
  const page = await context.newPage();

  const network = [];
  const consoleMsgs = [];
  const wsLog = [];
  const wsByUrl = new Map();

  page.on('request', (req) => {
    network.push({
      t: Date.now(),
      type: 'request',
      url: req.url(),
      method: req.method(),
      resourceType: req.resourceType(),
      headers: req.headers(),
      postData: req.postData() || null,
    });
  });
  page.on('response', async (res) => {
    const entry = {
      t: Date.now(),
      type: 'response',
      url: res.url(),
      status: res.status(),
      contentType: res.headers()['content-type'] || null,
    };
    network.push(entry);
  });
  page.on('requestfailed', (req) => {
    network.push({ t: Date.now(), type: 'failed', url: req.url(), failure: req.failure()?.errorText });
  });
  page.on('console', (msg) => {
    consoleMsgs.push({ t: Date.now(), type: msg.type(), text: msg.text() });
  });
  page.on('pageerror', (err) => {
    consoleMsgs.push({ t: Date.now(), type: 'pageerror', text: String(err) });
  });
  page.on('websocket', (ws) => {
    const rec = { url: ws.url(), openedAt: Date.now(), framesSent: [], framesReceived: [], closed: false };
    wsLog.push(rec);
    wsByUrl.set(ws.url(), rec);
    ws.on('framesent', (f) => { if (rec.framesSent.length < 50) rec.framesSent.push({ t: Date.now(), payload: f.payload }); });
    ws.on('framereceived', (f) => { if (rec.framesReceived.length < 50) rec.framesReceived.push({ t: Date.now(), payload: f.payload }); });
    ws.on('close', () => { rec.closed = true; rec.closedAt = Date.now(); });
  });

  console.log('navigating...');
  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
  try { await page.waitForLoadState('networkidle', { timeout: 45000 }); } catch (e) { console.log('networkidle timeout (continuing)'); }
  await page.waitForTimeout(5000);

  const title = await page.title();
  const finalUrl = page.url();
  console.log('title:', title, '| finalUrl:', finalUrl);

  await page.screenshot({ path: path.join(SHOTS, '01-landing.png'), fullPage: true });
  await page.screenshot({ path: path.join(SHOTS, '01-landing-viewport.png'), fullPage: false });

  const html = await page.content();
  fs.writeFileSync(path.join(OUT, 'play.rendered.html'), html);

  // Storage
  const storage = await page.evaluate(() => {
    const dump = (s) => { const o = {}; for (let i = 0; i < s.length; i++) { const k = s.key(i); o[k] = s.getItem(k); } return o; };
    return { localStorage: dump(localStorage), sessionStorage: dump(sessionStorage) };
  });
  const cookies = await context.cookies();

  // DOM outline: top-level structure of body (for orientation)
  const domOutline = await page.evaluate(() => {
    const walk = (el, depth, max) => {
      if (depth > max) return null;
      const kids = [];
      for (const c of el.children) {
        if (c.tagName === 'SCRIPT' || c.tagName === 'STYLE' || c.tagName === 'LINK') continue;
        const r = c.getBoundingClientRect ? c.getBoundingClientRect() : null;
        kids.push({
          tag: c.tagName.toLowerCase(),
          id: c.id || undefined,
          cls: (c.className && typeof c.className === 'string') ? c.className.slice(0, 200) : undefined,
          rect: r ? { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) } : undefined,
          text: (c.children.length === 0 ? (c.textContent || '').trim().slice(0, 80) : undefined),
          children: walk(c, depth + 1, max),
        });
      }
      return kids.length ? kids : undefined;
    };
    return walk(document.body, 0, 5);
  });

  fs.writeFileSync(path.join(OUT, 'network.json'), JSON.stringify(network, null, 2));
  fs.writeFileSync(path.join(OUT, 'ws.json'), JSON.stringify(wsLog, null, 2));
  fs.writeFileSync(path.join(OUT, 'console.json'), JSON.stringify(consoleMsgs, null, 2));
  fs.writeFileSync(path.join(OUT, 'storage.json'), JSON.stringify({ localStorage: storage.localStorage, sessionStorage: storage.sessionStorage, cookies: cookies.map(c => ({ name: c.name, domain: c.domain, path: c.path, expires: c.expires })) }, null, 2));
  fs.writeFileSync(path.join(OUT, 'dom-outline.json'), JSON.stringify(domOutline, null, 2));

  // Interactive elements inventory
  const interactives = await page.evaluate(() => {
    const els = document.querySelectorAll('button, a, input, select, textarea, [role=button], [role=tab], [role=menuitem], [onclick], [class*=btn], [class*=button]');
    return [...els].slice(0, 300).map((el) => {
      const r = el.getBoundingClientRect();
      return {
        tag: el.tagName.toLowerCase(),
        id: el.id || undefined,
        cls: typeof el.className === 'string' ? el.className.slice(0, 150) : undefined,
        text: (el.innerText || el.value || el.placeholder || el.getAttribute('aria-label') || '').trim().slice(0, 100),
        href: el.getAttribute('href') || undefined,
        rect: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) },
        visible: r.width > 0 && r.height > 0,
      };
    });
  });
  fs.writeFileSync(path.join(OUT, 'interactives.json'), JSON.stringify(interactives, null, 2));

  console.log('interactive elements:', interactives.filter(i => i.visible).length, 'visible of', interactives.length);
  console.log('network entries:', network.length, '| ws:', wsLog.length, '| console:', consoleMsgs.length);
  console.log('storage keys:', Object.keys(storage.localStorage), Object.keys(storage.sessionStorage));
  console.log('cookies:', cookies.map(c => c.name));

  await browser.close();
})().catch((e) => { console.error('FATAL', e); process.exit(1); });
