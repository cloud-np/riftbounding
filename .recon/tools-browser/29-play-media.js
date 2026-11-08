// Scroll riftatlas.com/play fully; capture preview media (board videos/posters)
const { launch, shot, saveJSON } = require('./lib');

(async () => {
  const { browser, page, log } = await launch();
  await page.goto('https://riftatlas.com/play', { waitUntil: 'domcontentloaded', timeout: 60000 });
  try { await page.waitForLoadState('networkidle', { timeout: 40000 }); } catch {}
  await page.waitForTimeout(3000);

  // scroll through page to trigger lazy loads
  const height = await page.evaluate(() => document.body.scrollHeight);
  console.log('page height:', height);
  for (let y = 0; y < height; y += 700) {
    await page.evaluate((yy) => window.scrollTo(0, yy), y);
    await page.waitForTimeout(400);
  }
  await page.waitForTimeout(4000);

  // inventory media elements
  const media = await page.evaluate(() => {
    const out = [];
    document.querySelectorAll('video').forEach((v) => {
      const r = v.getBoundingClientRect();
      out.push({ kind: 'video', src: v.currentSrc || v.src, poster: v.poster, sources: [...v.querySelectorAll('source')].map((s) => s.src), rect: { x: Math.round(r.x), y: Math.round(r.y + window.scrollY), w: Math.round(r.width), h: Math.round(r.height) }, autoplay: v.autoplay, loop: v.loop, muted: v.muted, controls: v.controls });
    });
    document.querySelectorAll('img').forEach((i) => {
      if (/preview|rewind|auto-pay|conquer|board|simulator/i.test(i.src + i.alt)) {
        const r = i.getBoundingClientRect();
        out.push({ kind: 'img', src: i.src, alt: i.alt, rect: { x: Math.round(r.x), y: Math.round(r.y + window.scrollY), w: Math.round(r.width), h: Math.round(r.height) } });
      }
    });
    return out;
  });
  console.log(JSON.stringify(media, null, 1).slice(0, 6000));
  saveJSON('29-play-media', media);

  // screenshot each media region
  let i = 0;
  for (const m of media.filter((x) => x.rect.w > 200)) {
    i++;
    await page.evaluate((y) => window.scrollTo(0, Math.max(0, y - 200)), m.rect.y);
    await page.waitForTimeout(1500);
    await shot(page, `29-play-preview-${i}`);
  }

  // network media requests
  const vids = log.network.filter((n) => n.kind === 'req' && /\.(mp4|webm|mov|m3u8)/.test(n.url));
  console.log('--- video requests ---');
  vids.forEach((v) => console.log(v.url));
  saveJSON('29-play-video-requests', vids);

  await browser.close();
})().catch((e) => { console.error('FATAL', e); process.exit(1); });
