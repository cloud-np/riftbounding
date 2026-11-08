// Extract zone map + colors from the board preview
const { launch, saveJSON, shot } = require('./lib');

(async () => {
  const { browser, page } = await launch();
  await page.goto('https://play.riftatlas.com/customize', { waitUntil: 'domcontentloaded', timeout: 60000 });
  try { await page.waitForLoadState('networkidle', { timeout: 30000 }); } catch {}
  await page.waitForTimeout(3000);
  await page.getByRole('button', { name: /view full board/i }).first().click();
  await page.waitForTimeout(5000);

  const map = await page.evaluate(() => {
    const pick = (el) => { if (!el) return null; const r = el.getBoundingClientRect(); const cs = getComputedStyle(el); return { rect: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) }, bg: cs.backgroundColor, color: cs.color, border: cs.borderColor, radius: cs.borderRadius, font: cs.fontFamily.slice(0, 40), fontSize: cs.fontSize }; };
    const byText = (txt, tag = '*') => [...document.querySelectorAll(tag)].find((e) => (e.textContent || '').trim() === txt);
    const boardRoot = document.querySelector('[class*="rounded-xs"]');
    const out = {
      boardRoot: pick(boardRoot),
      youNameplate: pick(byText('You')),
      opponentNameplate: pick(byText('Opponent')),
      mainPhase: pick(byText('MAIN PHASE')),
      switchBtn: pick([...document.querySelectorAll('button')].find((b) => /switch/i.test(b.textContent))),
      leaveBtn: pick([...document.querySelectorAll('button')].find((b) => /leave/i.test(b.textContent))),
      turnHeader: pick([...document.querySelectorAll('*')].find((e) => /^Turn \d/.test((e.textContent || '').trim()) && e.children.length < 4)),
      chat: pick([...document.querySelectorAll('*')].find((e) => (e.textContent || '').trim() === 'CHAT' && e.children.length === 0)),
      matchLog: pick(byText('MATCH LOG')),
      floating: pick(byText('FLOATING')),
      tokenPanelBtn: pick(byText('TOKEN PANEL')),
      revealBtn: pick(byText('REVEAL TO OPPONENT')),
      playHiddenBtn: pick(byText('PLAY FROM HIDDEN')),
      targetBtn: pick(byText('TARGET')),
      noCard: pick(byText('No card')),
      viewFullBoardTitle: pick(byText('View full board')),
    };
    // battlefield zones: 4 big bordered rects in the middle
    const zones = [...document.querySelectorAll('div')].filter((d) => {
      const r = d.getBoundingClientRect();
      const cs = getComputedStyle(d);
      return r.width > 500 && r.height > 250 && cs.borderStyle !== 'none' && cs.borderWidth !== '0px' && (cs.borderColor || '').includes('rgba');
    }).map((d) => { const r = d.getBoundingClientRect(); return { rect: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) }, border: getComputedStyle(d).borderColor, cls: String(d.className).slice(0, 80) }; });
    out.battlefieldZones = zones.slice(0, 8);
    // turn track numbers
    out.turnTrack = [...document.querySelectorAll('*')].filter((e) => /^\d$/.test((e.textContent || '').trim()) && e.children.length === 0).slice(0, 24).map((e) => { const r = e.getBoundingClientRect(); return { n: e.textContent.trim(), x: Math.round(r.x), y: Math.round(r.y) }; });
    // colors of specific things
    const body = getComputedStyle(document.body);
    out.pageBg = body.backgroundColor;
    out.bodyFont = body.fontFamily.slice(0, 80);
    return out;
  });
  saveJSON('49-board-zonemap', map);
  console.log(JSON.stringify(map, null, 1).slice(0, 5000));
  await browser.close();
})().catch((e) => { console.error('FATAL', e); process.exit(1); });
