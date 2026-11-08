// Recon B: generic full capture of a URL
// usage: node capture-url.js <url> <name>
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const OUT = path.resolve(__dirname, '..', 'browser');
const SHOTS = path.resolve(__dirname, '..', 'screens');
const URL_ = process.argv[2];
const NAME = process.argv[3] || 'page';

(async () => {
  const browser = await chromium.launch({
    executablePath: '/usr/bin/chromium',
    headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'],
  });
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();

  const network = [];
  const consoleMsgs = [];
  const wsLog = [];

  page.on('request', (req) => network.push({ t: Date.now(), type: 'request', url: req.url(), method: req.method(), resourceType: req.resourceType(), postData: req.postData() ? req.postData().slice(0, 2000) : null }));
  page.on('response', (res) => network.push({ t: Date.now(), type: 'response', url: res.url(), status: res.status(), contentType: res.headers()['content-type'] || null }));
  page.on('requestfailed', (req) => network.push({ t: Date.now(), type: 'failed', url: req.url(), failure: req.failure()?.errorText }));
  page.on('console', (msg) => consoleMsgs.push({ t: Date.now(), type: msg.type(), text: msg.text().slice(0, 1000) }));
  page.on('pageerror', (err) => consoleMsgs.push({ t: Date.now(), type: 'pageerror', text: String(err).slice(0, 2000) }));
  page.on('websocket', (ws) => {
    const rec = { url: ws.url(), openedAt: Date.now(), framesSent: [], framesReceived: [], closed: false };
    wsLog.push(rec);
    ws.on('framesent', (f) => { if (rec.framesSent.length < 100) rec.framesSent.push({ t: Date.now(), payload: String(f.payload).slice(0, 4000) }); });
    ws.on('framereceived', (f) => { if (rec.framesReceived.length < 100) rec.framesReceived.push({ t: Date.now(), payload: String(f.payload).slice(0, 4000) }); });
    ws.on('close', () => { rec.closed = true; });
  });

  console.log('navigating to', URL_);
  await page.goto(URL_, { waitUntil: 'domcontentloaded', timeout: 60000 });
  try { await page.waitForLoadState('networkidle', { timeout: 45000 }); } catch (e) { console.log('networkidle timeout (continuing)'); }
  await page.waitForTimeout(6000);

  console.log('title:', await page.title(), '| url:', page.url());
  await page.screenshot({ path: path.join(SHOTS, NAME + '.png'), fullPage: true });
  await page.screenshot({ path: path.join(SHOTS, NAME + '-viewport.png'), fullPage: false });

  const html = await page.content();
  fs.writeFileSync(path.join(OUT, NAME + '.rendered.html'), html);

  const storage = await page.evaluate(() => {
    const dump = (s) => { const o = {}; for (let i = 0; i < s.length; i++) { const k = s.key(i); o[k] = s.getItem(k); } return o; };
    return { localStorage: dump(localStorage), sessionStorage: dump(sessionStorage) };
  });
  const cookies = await context.cookies();

  const interactives = await page.evaluate(() => {
    const els = document.querySelectorAll('button, a, input, select, textarea, [role=button], [role=tab], [role=menuitem], [onclick], [class*=btn], [class*=button]');
    return [...els].slice(0, 500).map((el) => {
      const r = el.getBoundingClientRect();
      return {
        tag: el.tagName.toLowerCase(),
        id: el.id || undefined,
        cls: typeof el.className === 'string' ? el.className.slice(0, 150) : undefined,
        text: (el.innerText || el.value || el.placeholder || el.getAttribute('aria-label') || el.getAttribute('title') || '').trim().slice(0, 120),
        href: el.getAttribute('href') || undefined,
        rect: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) },
        visible: r.width > 0 && r.height > 0,
      };
    });
  });

  // canvases
  const canvases = await page.evaluate(() => [...document.querySelectorAll('canvas')].map(c => { const r = c.getBoundingClientRect(); return { id: c.id, cls: c.className, w: c.width, h: c.height, rect: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) } }; }));

  fs.writeFileSync(path.join(OUT, NAME + '.network.json'), JSON.stringify(network, null, 2));
  fs.writeFileSync(path.join(OUT, NAME + '.ws.json'), JSON.stringify(wsLog, null, 2));
  fs.writeFileSync(path.join(OUT, NAME + '.console.json'), JSON.stringify(consoleMsgs, null, 2));
  fs.writeFileSync(path.join(OUT, NAME + '.storage.json'), JSON.stringify({ localStorage: storage.localStorage, sessionStorage: storage.sessionStorage, cookies: cookies.map(c => ({ name: c.name, domain: c.domain, path: c.path })) }, null, 2));
  fs.writeFileSync(path.join(OUT, NAME + '.interactives.json'), JSON.stringify(interactives, null, 2));
  fs.writeFileSync(path.join(OUT, NAME + '.canvases.json'), JSON.stringify(canvases, null, 2));

  console.log('interactives visible:', interactives.filter(i => i.visible).length, '/', interactives.length);
  console.log('network:', network.length, '| ws:', wsLog.length, '| console:', consoleMsgs.length);
  console.log('localStorage keys:', Object.keys(storage.localStorage));
  console.log('cookies:', cookies.map(c => c.name).join(', '));
  console.log('canvases:', JSON.stringify(canvases));

  await browser.close();
})().catch((e) => { console.error('FATAL', e); process.exit(1); });
