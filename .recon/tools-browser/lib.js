// Shared helpers for recon scripts
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const OUT = path.resolve(__dirname, '..', 'browser');
const SHOTS = path.resolve(__dirname, '..', 'screens');

async function launch(opts = {}) {
  const browser = await chromium.launch({
    executablePath: '/usr/bin/chromium',
    headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'],
  });
  const context = await browser.newContext({
    viewport: opts.viewport || { width: 1920, height: 1080 },
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();
  const log = { console: [], ws: [], network: [] };
  page.on('console', (m) => log.console.push({ t: Date.now(), type: m.type(), text: m.text().slice(0, 800) }));
  page.on('pageerror', (e) => log.console.push({ t: Date.now(), type: 'pageerror', text: String(e).slice(0, 1500) }));
  page.on('request', (r) => log.network.push({ t: Date.now(), kind: 'req', method: r.method(), url: r.url(), type: r.resourceType(), post: r.postData() ? r.postData().slice(0, 3000) : null }));
  page.on('response', (r) => log.network.push({ t: Date.now(), kind: 'res', status: r.status(), url: r.url(), ct: r.headers()['content-type'] }));
  page.on('websocket', (ws) => {
    const rec = { url: ws.url(), sent: [], received: [] };
    log.ws.push(rec);
    ws.on('framesent', (f) => { if (rec.sent.length < 200) rec.sent.push({ t: Date.now(), p: String(f.payload).slice(0, 5000) }); });
    ws.on('framereceived', (f) => { if (rec.received.length < 200) rec.received.push({ t: Date.now(), p: String(f.payload).slice(0, 5000) }); });
  });
  return { browser, context, page, log };
}

async function shot(page, name, fullPage = false) {
  await page.screenshot({ path: path.join(SHOTS, name + '.png'), fullPage });
  console.log('shot:', name + '.png');
}

// Dump outerHTML of first matching element (or all matches up to limit)
async function dumpDOM(page, selector, name, limit = 3) {
  const html = await page.evaluate(({ sel, lim }) => {
    const els = [...document.querySelectorAll(sel)].slice(0, lim);
    return els.map((e) => e.outerHTML.slice(0, 20000)).join('\n\n<!-- ==== -->\n\n');
  }, { sel: selector, lim: limit });
  fs.writeFileSync(path.join(OUT, name + '.html'), html || '<!-- no match: ' + selector + ' -->');
  console.log('dom dump:', name + '.html', html ? `(${html.length} chars)` : '(no match)');
  return html;
}

function saveJSON(name, obj) {
  fs.writeFileSync(path.join(OUT, name + '.json'), JSON.stringify(obj, null, 2));
}

module.exports = { launch, shot, dumpDOM, saveJSON, OUT, SHOTS };
