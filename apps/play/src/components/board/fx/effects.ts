/**
 * Effect choreography. Every effect is an async function started synchronously inside the
 * commit (so real elements can be hidden before first paint) and cancelled via the context on
 * unmount. Animation of on-board cards only touches `translate`, `scale`, `filter`, `opacity`.
 */
import { DOMAIN_PALETTES, EASE, SIDE_COLORS, domainPalette } from "../theme/domain-colors";
import type { CardEntry, CardGeneration, Box, Ghost } from "./dom";
import {
  battlefieldBox,
  boardBox,
  boxOf,
  createGhost,
  cx,
  cy,
  el,
  liveCard,
  liveEntry,
  queryBox,
  scoreBox,
  settledBox,
  zoneBox,
} from "./dom";
import type { FxContext } from "./context";
import { createBackGhost, createCardGhost, createShowcaseGhost, type CardGhost } from "./ghosts";
import type { ClashUnit, FxEvent } from "./types";

type Ev<T extends FxEvent["type"]> = Extract<FxEvent, { type: T }>;

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const easeOut3 = (t: number) => 1 - (1 - t) ** 3;
const CARD_ASPECT = 88 / 63;

function rgbOf(card: { domains?: string[] }): { rgb: string; light: string; dark: string } {
  const palette = domainPalette(card.domains);
  return { rgb: palette.rgb, light: palette.light, dark: palette.dark };
}

function sideRgb(ctx: FxContext, playerId: string): string {
  return playerId === ctx.viewerId ? SIDE_COLORS.self.rgb : SIDE_COLORS.opponent.rgb;
}

function opponentHandOrigin(): { x: number; y: number } {
  const zone = zoneBox("hand", "opponent");
  if (zone) return { x: cx(zone), y: zone.top + zone.height * 0.3 };
  const board = boardBox();
  return { x: board.left + board.width / 2, y: board.top - 20 };
}

function selfHandOrigin(): { x: number; y: number } {
  const zone = zoneBox("hand", "self");
  if (zone) return { x: cx(zone), y: cy(zone) };
  const board = boardBox();
  return { x: board.left + board.width / 2, y: board.top + board.height + 20 };
}

/* ------------------------------------------------------------------ card play slam */

export async function playCard(ctx: FxContext, ev: Ev<"card_played">, gen: CardGeneration, delay: number) {
  const dest = liveEntry(ev.card.id);
  if (!dest) return;
  const { rgb } = rgbOf(ev.card);
  if (ctx.level === "reduced") {
    ctx.animate(dest.el, [{ scale: "1.16", filter: "brightness(1.5)" }, { scale: "1", filter: "none" }], {
      duration: 260,
      delay,
      easing: EASE.out,
    });
    return;
  }
  const destBox = settledBox(dest);
  const prev = gen.get(ev.card.id);
  let originX: number;
  let originY: number;
  /** Width of the full card at the origin (hand card width). */
  let handW = 0;
  if (ev.fromZone === "none") {
    originX = cx(destBox);
    originY = cy(destBox);
  } else if (prev) {
    originX = cx(prev.rect);
    originY = cy(prev.rect);
    handW = clamp(prev.rect.width, dest.layoutW * 0.6, dest.layoutW * 2.4);
  } else {
    const o = ev.isViewer ? selfHandOrigin() : opponentHandOrigin();
    originX = o.x;
    originY = o.y;
    handW = dest.layoutW * (ev.isViewer ? 1.3 : 0.9);
  }
  ctx.hide(dest.el);
  const release = ctx.own(() => ctx.show(dest.el));
  if (!(await ctx.wait(delay))) return;
  // Layout may have shifted while waiting for earlier events.
  const liveBox = settledBox(dest, boxOf(dest.el));
  const side = dest.side;
  // Units enter exhausted; the real token rotates via CSS, so read the flag rather than the transform.
  const exhausted = dest.el.dataset.exhausted === "true";
  const restAngle = exhausted ? 90 : dest.angle;
  const ghost = createCardGhost({
    stage: ctx.stage,
    card: ev.card,
    side,
    at: liveBox,
    token: true,
    fullWidth: ev.fromZone === "none" ? 0 : handW,
    exhausted,
  });
  const removeGhost = ctx.own(ghost.remove);
  const tokenLayer = ghost.tokenLayer;
  if (tokenLayer && ev.fromZone === "none") tokenLayer.style.rotate = `${restAngle}deg`;
  const gx = cx(liveBox);
  const gy = cy(liveBox);
  const impactX = gx;
  const impactY = liveBox.top + liveBox.height * 0.88;

  if (ev.fromZone === "none" || !tokenLayer) {
    // Token / spawned unit: pop in with a flare.
    ctx.animate((tokenLayer ?? ghost.inner), 
      [
        { scale: "0.3", opacity: 0 },
        { scale: "1.2", opacity: 1, offset: 0.55 },
        { scale: "0.95", offset: 0.8 },
        { scale: "1", opacity: 1 },
      ],
      { duration: 360, easing: EASE.slam, fill: "both" },
    );
    await ctx.wait(160);
    impact(ctx, ev.card.might ?? 2, rgb, liveBox, impactX, impactY, 0.7);
    await ctx.wait(210);
    release();
    removeGhost();
    return;
  }

  const sx = originX - gx;
  const sy = originY - gy;
  const dist = Math.hypot(sx, sy);
  const arc = 50 + dist * 0.14;
  const flight = 380;
  const lift = 1.12; // brief hover scale of the token before the slam (kept close to its real size)
  ctx.animate(ghost.outer, 
    [
      { translate: `${sx}px ${sy}px`, opacity: 0.2, offset: 0, easing: "cubic-bezier(0.2, 0.7, 0.3, 1)" },
      { translate: `${sx * 0.42}px ${sy * 0.42 - arc}px`, opacity: 1, offset: 0.5, easing: "cubic-bezier(0.5, 0, 0.85, 0.45)" },
      { translate: "0px 0px", opacity: 1, offset: 1 },
    ],
    { duration: flight, fill: "forwards" },
  );
  ctx.animate(ghost.inner, 
    [
      { transform: "perspective(900px) rotateX(24deg) rotateZ(-9deg)", offset: 0, easing: "cubic-bezier(0.2, 0.7, 0.3, 1)" },
      { transform: "perspective(900px) rotateX(12deg) rotateZ(-3deg)", offset: 0.5, easing: "ease-in" },
      { transform: "perspective(900px) rotateX(0deg) rotateZ(0deg)", offset: 1 },
    ],
    { duration: flight, fill: "forwards" },
  );
  // Morph: the full card (hand size) shrinks and dissolves into the token (its exact board size).
  const fullLayer = ghost.fullLayer;
  const startRatio = handW / ghost.w;
  if (fullLayer) ctx.animate(fullLayer, 
    [
      { scale: "1", opacity: 1, offset: 0 },
      { scale: "1.04", opacity: 1, offset: 0.4 },
      { scale: `${(ghost.w * lift) / handW}`, opacity: 0, offset: 0.9 },
      { scale: `${(ghost.w * lift) / handW}`, opacity: 0, offset: 1 },
    ],
    { duration: flight, easing: "ease-in-out", fill: "forwards" },
  );
  ctx.animate(tokenLayer, 
    [
      { scale: `${startRatio}`, opacity: 0, rotate: "0deg", offset: 0 },
      { scale: `${startRatio * 1.04}`, opacity: 0, rotate: "0deg", offset: 0.35 },
      { scale: `${lift * 1.05}`, opacity: 1, rotate: `${restAngle * 0.5}deg`, offset: 0.8 },
      { scale: `${lift}`, opacity: 1, rotate: `${restAngle}deg`, offset: 1 },
    ],
    { duration: flight, easing: "ease-in-out", fill: "forwards" },
  );
  ghost.inner.style.filter = `drop-shadow(0 14px 14px rgba(0,0,0,0.5)) drop-shadow(0 0 14px rgba(${rgb},0.7))`;
  if (!(await ctx.wait(flight))) return;
  const slam = 230;
  ctx.animate(tokenLayer, 
    [
      { scale: `${lift}`, offset: 0, easing: "cubic-bezier(0.6, 0, 0.9, 0.5)" },
      { scale: "0.92", offset: 0.42, easing: EASE.out },
      { scale: "1", offset: 1 },
    ],
    { duration: slam, fill: "forwards" },
  );
  ctx.animate(ghost.inner, 
    [{ filter: ghost.inner.style.filter }, { filter: "none" }],
    { duration: slam, delay: slam * 0.4, fill: "forwards" },
  );
  if (!(await ctx.wait(slam * 0.42))) return;
  impact(ctx, ev.card.might ?? 2, rgb, liveBox, impactX, impactY, 1);
  if (!(await ctx.wait(slam * 0.58))) return;
  release();
  removeGhost();
}

function impact(ctx: FxContext, might: number, rgb: string, box: Box, x: number, y: number, power: number) {
  const engine = ctx.engine();
  if (engine) {
    const w = box.width;
    engine.emitFlash(cx(box), cy(box), rgb, { radius: w * 1.2 * power, duration: 0.3 });
    engine.emitRing(x, y, rgb, { radius: w * 1.5 * power, from: w * 0.2, duration: 0.5, width: 8, squash: 0.42 });
    engine.emitRing(x, y, "255,255,255", { radius: w * 0.9 * power, from: w * 0.15, duration: 0.36, width: 4, squash: 0.4 });
    engine.emitBurst(x, y, rgb, { count: Math.round(26 * power), speed: 460, angle: -Math.PI / 2, spread: Math.PI * 1.1, life: 0.5, gravity: 900 });
    engine.emitDust(x, y, Math.round(10 * power), w * 1.2);
  }
  ctx.shake(clamp(1.8 + might * 0.7, 2, 6) * Math.min(1, power + 0.2), 200);
}

/* ------------------------------------------------------------------ unit move */

export async function moveUnit(ctx: FxContext, ev: Ev<"unit_moved">, gen: CardGeneration, delay: number) {
  if (ctx.level !== "full") return;
  const dest = liveEntry(ev.card.id);
  const prev = gen.get(ev.card.id);
  if (!dest || !prev) return;
  const destRect = settledBox(dest);
  const dx = cx(destRect) - cx(prev.rect);
  const dy = cy(destRect) - cy(prev.rect);
  const dist = Math.hypot(dx, dy);
  if (dist < 24) return;
  const { rgb } = rgbOf(ev.card);
  ctx.hide(dest.el);
  const release = ctx.own(() => ctx.show(dest.el));
  if (!(await ctx.wait(delay))) return;
  const ghost = createGhost(ctx.stage, dest, prev.rect);
  const removeGhost = ctx.own(ghost.remove);
  const duration = clamp(200 + dist * 0.25, 240, 380);
  ctx.animate(ghost.outer, 
    [{ translate: "0px 0px" }, { translate: `${dx}px ${dy}px` }],
    { duration, easing: "cubic-bezier(0.3, 0.1, 0.2, 1)", fill: "forwards" },
  );
  ctx.animate(ghost.inner, 
    [{ scale: "1" }, { scale: "1.12", offset: 0.4 }, { scale: "1" }],
    { duration, easing: "ease-out", fill: "forwards" },
  );
  const ux = dx / dist;
  const uy = dy / dist;
  const engine = ctx.engine();
  let lastEmit = 0;
  const ok = await ctx.frames(duration, (t) => {
    if (!engine || t - lastEmit < 0.1) return;
    lastEmit = t;
    const e = easeOut3(t);
    const x = ghost.center.x + dx * e;
    const y = ghost.center.y + dy * e;
    engine.emitStreak(x - ux * ghost.w * 0.3, y - uy * ghost.h * 0.3, rgb, ux, uy, 70, 0.26);
  });
  if (!ok) return;
  if (engine) {
    const x = cx(destRect);
    const y = destRect.top + destRect.height * 0.9;
    engine.emitDust(x, y, 8, destRect.width);
    engine.emitRing(x, y, rgb, { radius: destRect.width * 0.8, from: 10, duration: 0.35, width: 4, squash: 0.4 });
  }
  ctx.shake(1.5, 120);
  release();
  removeGhost();
}

/* ------------------------------------------------------------------ spells */

export async function castSpell(ctx: FxContext, ev: Ev<"spell_cast">, gen: CardGeneration, delay: number) {
  const { rgb } = rgbOf(ev.card);
  const board = boardBox();
  const own = ev.isViewer;
  const height = clamp(board.height * (own ? 0.34 : 0.46), 200, own ? 300 : 400);
  const width = height / CARD_ASPECT;
  const x = board.left + board.width * (own ? 0.34 : 0.3);
  const y = board.top + board.height * 0.46;
  ctx.castOrigins.set(ev.chainEntryId, { x, y });
  if (ctx.level === "reduced") return;
  if (!(await ctx.wait(delay))) return;
  const source = ev.isViewer ? (gen.get(ev.card.id)?.rect ?? null) : null;
  const origin = source ? { x: cx(source), y: cy(source) } : own ? selfHandOrigin() : opponentHandOrigin();
  const at = { left: x - width / 2, top: y - height / 2, width, height };
  // The exact full-card visual the board uses, at showcase size.
  const ghost: CardGhost = createShowcaseGhost(ctx.stage, ev.card, own ? "self" : "opponent", at);
  const layer = ghost.fullLayer ?? ghost.inner;
  const removeGhost = ctx.own(ghost.remove);
  const hold = own ? 280 : 1050;
  const fly = 300;
  const sx = origin.x - x;
  const sy = origin.y - y;
  ctx.animate(ghost.outer, 
    [
      { translate: `${sx}px ${sy}px`, opacity: 0, offset: 0 },
      { opacity: 1, offset: 0.25 },
      { translate: "0px 0px", opacity: 1, offset: 1 },
    ],
    { duration: fly, easing: EASE.out, fill: "forwards" },
  );
  const base = own ? 0.82 : 1;
  const startScale = source ? clamp(source.width / width, 0.25, 0.8) : 0.35;
  ghost.inner.style.filter = `drop-shadow(0 0 22px rgba(${rgb},0.85)) drop-shadow(0 16px 20px rgba(0,0,0,0.5))`;
  ctx.animate(ghost.inner, 
    [
      { transform: "perspective(900px) rotateY(70deg)", offset: 0 },
      { transform: "perspective(900px) rotateY(0deg)", offset: 0.6 },
      { transform: "perspective(900px) rotateY(0deg)", offset: 1 },
    ],
    { duration: fly + 80, easing: EASE.slam, fill: "forwards" },
  );
  ctx.animate(layer, 
    [
      { scale: `${startScale}`, offset: 0 },
      { scale: `${base * 1.1}`, offset: 0.6 },
      { scale: `${base}`, offset: 1 },
    ],
    { duration: fly + 80, easing: EASE.slam, fill: "forwards" },
  );
  const engine = ctx.engine();
  engine?.emitCircle(x, y, rgb, { radius: height * (own ? 0.55 : 0.8), duration: (fly + hold + 180) / 1000 });
  engine?.emitFlash(x, y, rgb, { radius: height * 0.7, duration: 0.5, alpha: 0.7 });
  if (!(await ctx.wait(fly))) return;
  engine?.emitBurst(x, y, rgb, { count: 24, speed: 360, life: 0.6, gravity: 200 });
  if (!own) {
    // gentle hover while the player reads the card
    ctx.animate(ghost.inner, 
      [{ translate: "0px 0px" }, { translate: "0px -8px" }, { translate: "0px 0px" }],
      { duration: hold, easing: "ease-in-out" },
    );
  }
  if (!(await ctx.wait(hold))) return;
  ctx.animate(ghost.outer, 
    [
      { opacity: 1, translate: "0px 0px" },
      { opacity: 0, translate: "0px -30px" },
    ],
    { duration: 280, easing: "ease-in", fill: "forwards" },
  );
  ctx.animate(layer, [{ scale: `${base}` }, { scale: `${base * 0.8}` }], {
    duration: 280,
    easing: "ease-in",
    fill: "forwards",
  });
  await ctx.wait(290);
  removeGhost();
}

interface ProjectileOptions {
  from: { x: number; y: number };
  to: { x: number; y: number };
  rgb: string;
  duration: number;
}

async function projectile(ctx: FxContext, { from, to, rgb, duration }: ProjectileOptions): Promise<boolean> {
  const orb = el("div", "fx-orb", ctx.top);
  orb.style.setProperty("--fx-rgb", rgb);
  const removeOrb = ctx.own(() => orb.remove());
  const engine = ctx.engine();
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const ctrlX = from.x + dx * 0.5 + dy * 0.12;
  const ctrlY = from.y + dy * 0.5 - Math.min(160, Math.hypot(dx, dy) * 0.3);
  const ok = await ctx.frames(duration, (t) => {
    const e = t * t * (3 - 2 * t);
    const x = (1 - e) * (1 - e) * from.x + 2 * (1 - e) * e * ctrlX + e * e * to.x;
    const y = (1 - e) * (1 - e) * from.y + 2 * (1 - e) * e * ctrlY + e * e * to.y;
    orb.style.transform = `translate3d(${x}px, ${y}px, 0) translate(-50%, -50%) scale(${0.8 + e * 0.5})`;
    engine?.emitTrail(x, y, rgb, 18 + e * 8);
    engine?.emitTrail(x, y, "255,255,255", 7);
  });
  removeOrb();
  return ok;
}

function targetImpact(ctx: FxContext, at: { x: number; y: number }, rgb: string, box: Box | null) {
  const engine = ctx.engine();
  engine?.emitFlash(at.x, at.y, rgb, { radius: 130, duration: 0.3 });
  engine?.emitBurst(at.x, at.y, rgb, { count: 30, speed: 480, life: 0.55 });
  engine?.emitRing(at.x, at.y, rgb, { radius: box ? box.width * 1.1 : 110, duration: 0.42, width: 6 });
  ctx.shake(3.5, 180);
}

export async function resolveSpell(ctx: FxContext, ev: Ev<"spell_resolved">, gen: CardGeneration, delay: number) {
  if (ctx.level === "reduced") return;
  const { rgb } = rgbOf(ev.card);
  const board = boardBox();
  const origin =
    ctx.castOrigins.get(ev.chainEntryId) ??
    (ev.isViewer
      ? { x: board.left + board.width * 0.4, y: board.top + board.height * 0.8 }
      : { x: board.left + board.width * 0.4, y: board.top + board.height * 0.15 });
  ctx.castOrigins.delete(ev.chainEntryId);
  if (!(await ctx.wait(delay))) return;
  const targets: Array<{ at: { x: number; y: number }; box: Box | null; el: HTMLElement | null }> = [];
  for (const id of ev.targetIds) {
    const live = liveEntry(id);
    const box = live?.rect ?? gen.get(id)?.rect ?? null;
    if (box) targets.push({ at: { x: cx(box), y: cy(box) }, box, el: live?.el ?? null });
  }
  if (targets.length === 0) {
    const centre = { x: board.left + board.width / 2, y: board.top + board.height / 2 };
    if (!(await projectile(ctx, { from: origin, to: centre, rgb, duration: 380 }))) return;
    targetImpact(ctx, centre, rgb, null);
    return;
  }
  await Promise.all(
    targets.slice(0, 5).map(async (target, index) => {
      if (!(await ctx.wait(index * 90))) return;
      if (!(await projectile(ctx, { from: origin, to: target.at, rgb, duration: 420 }))) return;
      targetImpact(ctx, target.at, rgb, target.box);
      if (target.el) ctx.hitReaction(target.el, "white");
    }),
  );
}

/* ------------------------------------------------------------------ showdown / conquer / turn banners */

const BLADES_SVG = `<svg class="fx-blades" viewBox="0 0 120 120" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><path d="M22 98 L88 22" stroke-width="7"/><path d="M98 98 L32 22" stroke-width="7"/><path d="M84 18 L100 14 L96 30 Z" fill="currentColor" stroke-width="2"/><path d="M36 18 L20 14 L24 30 Z" fill="currentColor" stroke-width="2"/><path d="M14 90 L30 106 M106 90 L90 106" stroke-width="9"/><circle cx="60" cy="60" r="7" stroke-width="3"/></g></svg>`;

export async function showdownStart(ctx: FxContext, ev: Ev<"showdown_start">, delay: number) {
  const box = battlefieldBox(ev.battlefield);
  const board = boardBox();
  const centre = box ? { x: cx(box), y: cy(box) } : { x: board.left + board.width / 2, y: board.top + board.height / 2 };
  if (!(await ctx.wait(delay))) return;
  const gold = SIDE_COLORS.contested.rgb;
  const banner = el("div", `fx-banner fx-banner--showdown${ctx.level === "reduced" ? " is-reduced" : ""}`, ctx.top);
  banner.style.left = `${centre.x}px`;
  banner.style.top = `${centre.y}px`;
  banner.innerHTML = `${BLADES_SVG}<span class="fx-banner-title">SHOWDOWN</span>`;
  const removeBanner = ctx.own(() => banner.remove());
  if (ctx.level === "full") {
    if (box) {
      const pulse = el("div", "fx-bf-pulse", ctx.top);
      pulse.style.left = `${box.left}px`;
      pulse.style.top = `${box.top}px`;
      pulse.style.width = `${box.width}px`;
      pulse.style.height = `${box.height}px`;
      const removePulse = ctx.own(() => pulse.remove());
      void ctx.wait(850).then(removePulse);
    }
    const dim = el("div", "fx-dim", ctx.stage);
    dim.style.setProperty("--fx-x", `${centre.x}px`);
    dim.style.setProperty("--fx-y", `${centre.y}px`);
    dim.style.setProperty("--fx-r", `${Math.max(180, (box?.width ?? 360) * 0.7)}px`);
    const removeDim = ctx.own(() => dim.remove());
    void ctx.wait(950).then(removeDim);
    const engine = ctx.engine();
    engine?.emitRing(centre.x, centre.y, gold, { radius: 260, from: 20, duration: 0.6, width: 7, squash: 0.7 });
    engine?.emitFlash(centre.x, centre.y, gold, { radius: 200, duration: 0.5, alpha: 0.7 });
    engine?.emitBurst(centre.x, centre.y, gold, { count: 24, speed: 520, life: 0.5, gravity: 100 });
    ctx.shake(3, 160);
  }
  await ctx.wait(ctx.level === "full" ? 720 : 700);
  removeBanner();
}

/** Soft volumetric beam + perspective ground ring (DOM, additive; low alpha so units stay readable). */
function conquerBeam(ctx: FxContext, centre: { x: number; y: number }, box: Box | null, board: Box, rgb: string) {
  const bw = box?.width ?? 260;
  const bh = box?.height ?? 200;
  const groundY = centre.y + bh * 0.28;
  const ringW = Math.max(240, bw * 0.95);
  const ringH = ringW * 0.3;
  const beamW = Math.max(120, bw * 0.46);
  const beamH = Math.max(320, board.height * 0.7);
  const holder = el("div", "fx-conquer", ctx.stage);
  holder.style.setProperty("--fx-rgb", rgb);
  const ground = el("div", "fx-ground-ring", holder);
  ground.style.left = `${centre.x - ringW / 2}px`;
  ground.style.top = `${groundY - ringH / 2}px`;
  ground.style.width = `${ringW}px`;
  ground.style.height = `${ringH}px`;
  const beam = el("div", "fx-beam", holder);
  beam.style.left = `${centre.x - beamW / 2}px`;
  beam.style.top = `${groundY - beamH}px`;
  beam.style.width = `${beamW}px`;
  beam.style.height = `${beamH}px`;
  beam.innerHTML = '<span class="fx-beam-glow"></span><span class="fx-beam-core"></span><span class="fx-beam-shimmer"></span>';
  const remove = ctx.own(() => holder.remove());
  ctx.animate(
    ground,
    [
      { opacity: 0, transform: "scale(0.35)" },
      { opacity: 1, transform: "scale(1)", offset: 0.28 },
      { opacity: 0.85, transform: "scale(1.06)", offset: 0.7 },
      { opacity: 0, transform: "scale(1.18)" },
    ],
    { duration: 1250, easing: "cubic-bezier(0.2, 0.8, 0.3, 1)", fill: "both" },
  );
  const anim = ctx.animate(
    beam,
    [
      { opacity: 0, transform: "scaleX(0.25) scaleY(0.2)" },
      { opacity: 1, transform: "scaleX(1) scaleY(1)", offset: 0.25 },
      { opacity: 0.8, transform: "scaleX(1.05) scaleY(1)", offset: 0.7 },
      { opacity: 0, transform: "scaleX(1.3) scaleY(1)" },
    ],
    { duration: 1250, easing: "cubic-bezier(0.2, 0.8, 0.3, 1)", fill: "both" },
  );
  anim.addEventListener("finish", remove);
  anim.addEventListener("cancel", remove);
  // Rising motes along the beam.
  const engine = ctx.engine();
  if (engine) {
    for (let i = 0; i < 4; i += 1) {
      void ctx.wait(i * 220).then((ok) => {
        if (ok) engine.emitEmbers(centre.x - beamW * 0.45, groundY - 10, beamW * 0.9, 16, rgb, 9, 150);
      });
    }
  }
}

export async function conquer(ctx: FxContext, ev: Ev<"conquer">, delay: number) {
  const box = battlefieldBox(ev.battlefield);
  const board = boardBox();
  const centre = box ? { x: cx(box), y: cy(box) } : { x: board.left + board.width / 2, y: board.top + board.height / 2 };
  const rgb = sideRgb(ctx, ev.playerId);
  if (!(await ctx.wait(delay))) return;
  const engine = ctx.engine();
  if (engine) {
    conquerBeam(ctx, centre, box, board, rgb);
    engine.emitRing(centre.x, centre.y + (box?.height ?? 0) * 0.28, rgb, { radius: Math.max(160, (box?.width ?? 200) * 0.7), from: 20, duration: 0.7, width: 6, squash: 0.3 });
    engine.emitFlash(centre.x, centre.y, rgb, { radius: 200, duration: 0.45, alpha: 0.45 });
  }
  const banner = el("div", `fx-banner fx-banner--conquer${ev.isViewer ? " is-self" : " is-opponent"}`, ctx.top);
  banner.style.left = `${centre.x}px`;
  banner.style.top = `${box ? box.top + box.height * 0.36 : centre.y}px`;
  banner.innerHTML = `<span class="fx-banner-title">CONQUERED</span>`;
  const removeBanner = ctx.own(() => banner.remove());
  await ctx.wait(ctx.level === "full" ? 1150 : 700);
  removeBanner();
}

export async function turnStart(ctx: FxContext, ev: Ev<"turn_start">, delay: number) {
  if (!(await ctx.wait(delay))) return;
  const board = boardBox();
  const banner = el(
    "div",
    `fx-banner fx-banner--turn ${ev.isViewer ? "is-self" : "is-opponent"}${ctx.level === "reduced" ? " is-reduced" : ""}`,
    ctx.top,
  );
  banner.style.left = `${board.left + board.width / 2}px`;
  banner.style.top = `${board.top + board.height * 0.46}px`;
  banner.innerHTML = `<span class="fx-banner-title">${ev.isViewer ? "YOUR TURN" : "OPPONENT’S TURN"}</span><span class="fx-banner-sweep"></span>`;
  const removeBanner = ctx.own(() => banner.remove());
  await ctx.wait(ctx.level === "full" ? 1350 : 800);
  removeBanner();
}

/* ------------------------------------------------------------------ damage / buff / score */

export async function nonCombatDamage(ctx: FxContext, ev: Ev<"damage">, delay: number) {
  const live = liveEntry(ev.card.id);
  if (!live) return;
  if (!(await ctx.wait(delay))) return;
  const box = settledBox(live, boxOf(live.el));
  ctx.hitReaction(live.el, "red");
  ctx.number(cx(box), box.top + box.height * 0.22, `-${ev.amount}`, "damage", 0, { big: true });
  const engine = ctx.engine();
  engine?.emitBurst(cx(box), cy(box), "255,70,60", { count: 16, speed: 380, life: 0.4 });
  engine?.emitFlash(cx(box), cy(box), "255,60,50", { radius: box.width * 0.9, duration: 0.25 });
  ctx.shake(clamp(1.5 + ev.amount * 0.6, 2, 6), 160);
}

export async function mightBuff(ctx: FxContext, ev: Ev<"might_buff">, delay: number) {
  const live = liveEntry(ev.card.id);
  if (!live) return;
  if (!(await ctx.wait(delay))) return;
  const box = settledBox(live, boxOf(live.el));
  ctx.hitReaction(live.el, "green");
  ctx.number(cx(box), box.top + box.height * 0.3, `+${ev.amount}`, "buff");
  const engine = ctx.engine();
  engine?.emitEmbers(box.left, box.top + box.height * 0.3, box.width, box.height * 0.7, "110,255,160", 20, 150);
  engine?.emitFlash(cx(box), cy(box), "110,255,160", { radius: box.width * 0.9, duration: 0.35, alpha: 0.6 });
}

export async function scoreOrb(ctx: FxContext, ev: Ev<"score">, delay: number) {
  const side = ev.isViewer ? "self" : "opponent";
  const target = scoreBox(side);
  if (!target) return;
  const board = boardBox();
  const bf = ev.battlefield ? battlefieldBox(ev.battlefield) : null;
  const from = bf ? { x: cx(bf), y: cy(bf) } : { x: board.left + board.width / 2, y: board.top + board.height / 2 };
  const to = { x: cx(target), y: cy(target) };
  const rgb = ev.isViewer ? "255,214,90" : "255,150,110";
  if (!(await ctx.wait(delay))) return;
  if (ctx.level === "full") {
    if (!(await projectile(ctx, { from, to, rgb, duration: 650 }))) return;
    const engine = ctx.engine();
    engine?.emitFlash(to.x, to.y, rgb, { radius: 120, duration: 0.4 });
    engine?.emitBurst(to.x, to.y, rgb, { count: 34, speed: 420, life: 0.7, gravity: 300 });
    engine?.emitRing(to.x, to.y, rgb, { radius: 100, from: 10, duration: 0.5, width: 5 });
  }
  ctx.number(to.x, to.y - 8, `+${ev.delta}`, "score");
  const node = document.querySelector<HTMLElement>(
    `[data-player-identity-rail][data-relation="${side}"]`,
  );
  if (node) ctx.animate(node, [{ scale: "1" }, { scale: "1.12" }, { scale: "1" }], { duration: 380, easing: EASE.slam });
}

/* ------------------------------------------------------------------ opponent draw / pile reveal */

export async function opponentDraw(ctx: FxContext, ev: Ev<"card_drawn">, delay: number) {
  if (ev.isViewer || ctx.level !== "full") return;
  const deck = queryBox('[data-pile-slot="mainDeck"][data-pile-owner="opponent"]') ?? queryBox('[data-pile-slot="mainDeck"]:not([data-pile-owner="self"])');
  const hand = zoneBox("hand", "opponent");
  if (!deck || !hand) return;
  if (!(await ctx.wait(delay))) return;
  const sample = document.querySelector<HTMLElement>('[data-drop-zone-root="hand"][data-zone-owner="opponent"] [data-board-card-visual="true"]');
  const sampleBox = sample ? boxOf(sample) : null;
  const w = clamp(sampleBox?.width ?? deck.width * 0.62, 36, 90);
  const h = w * CARD_ASPECT;
  const from = { x: cx(deck), y: cy(deck) };
  const to = { x: cx(hand), y: cy(hand) };
  const count = Math.min(ev.count, 3);
  await Promise.all(
    Array.from({ length: count }, async (_, i) => {
      if (!(await ctx.wait(i * 150))) return;
      const ghost = createBackGhost(ctx.stage, "opponent", { left: from.x - w / 2, top: from.y - h / 2, width: w, height: h });
      const remove = ctx.own(ghost.remove);
      const dx = to.x + (i - (count - 1) / 2) * w * 0.5 - from.x;
      const dy = to.y - from.y;
      ctx.animate(ghost.outer, 
        [
          { translate: "0px 0px", opacity: 0, offset: 0 },
          { opacity: 1, offset: 0.15 },
          { translate: `${dx * 0.6}px ${dy * 0.6 + 14}px`, opacity: 1, offset: 0.7 },
          { translate: `${dx}px ${dy}px`, opacity: 0, offset: 1 },
        ],
        { duration: 460, easing: "cubic-bezier(0.3, 0.1, 0.25, 1)", fill: "forwards" },
      );
      ctx.animate(ghost.inner, [{ scale: "1" }, { scale: "0.82" }], { duration: 460, easing: "ease-in", fill: "forwards" });
      if (!(await ctx.wait(480))) return;
      remove();
    }),
  );
}

/** Hide the (public) top card of a trash/banished pile while the dying ghost is still on screen. */
function holdPileTop(ctx: FxContext, cardId: string): () => void {
  const node = document.querySelector<HTMLElement>(`[data-pile-top-card][data-card-id="${CSS.escape(cardId)}"]`);
  if (!node) return () => undefined;
  ctx.hide(node);
  return ctx.own(() => {
    ctx.show(node);
    if (ctx.level === "full") ctx.animate(node, [{ opacity: 0, scale: "0.8" }, { opacity: 1, scale: "1" }], { duration: 240, easing: EASE.out });
  });
}

/* ------------------------------------------------------------------ death / dissolve */

let filterSeq = 0;

function dissolveFilter(ctx: FxContext, rgb: string): { id: string; setProgress: (p: number) => void; dispose: () => void } {
  const id = `fx-dissolve-${(filterSeq += 1)}`;
  const holder = document.createElement("div");
  holder.className = "fx-svg-defs";
  const [r, g, b] = rgb.split(",").map((v) => Number(v) / 255);
  const seed = Math.floor(Math.random() * 90);
  holder.innerHTML = `<svg width="0" height="0" aria-hidden="true"><filter id="${id}" x="-15%" y="-15%" width="130%" height="130%" color-interpolation-filters="sRGB">
<feTurbulence type="fractalNoise" baseFrequency="0.028 0.04" numOctaves="3" seed="${seed}" result="noise"/>
<feColorMatrix in="noise" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 1 0 0 0 0" result="n"/>
<feComponentTransfer in="n" result="maskA"><feFuncA class="a" type="linear" slope="14" intercept="0"/></feComponentTransfer>
<feComponentTransfer in="n" result="maskB"><feFuncA class="b" type="linear" slope="14" intercept="0"/></feComponentTransfer>
<feComposite in="SourceGraphic" in2="maskB" operator="in" result="body"/>
<feComposite in="maskA" in2="maskB" operator="out" result="band"/>
<feFlood flood-color="rgb(${Math.round(r! * 255)},${Math.round(g! * 255)},${Math.round(b! * 255)})" result="flood"/>
<feComposite in="flood" in2="band" operator="in" result="edge"/>
<feComposite in="edge" in2="SourceGraphic" operator="in" result="edgeClip"/>
<feMerge><feMergeNode in="body"/><feMergeNode in="edgeClip"/></feMerge></filter></svg>`;
  ctx.stage.appendChild(holder);
  const dispose = ctx.own(() => holder.remove());
  const a = holder.querySelector<SVGElement>(".a");
  const bNode = holder.querySelector<SVGElement>(".b");
  return {
    id,
    dispose,
    setProgress: (p: number) => {
      // alpha = clamp(14 * (noise - th)); noise ~ 0.2..0.8, so sweep th across that range.
      const th = -0.05 + p * 1.0;
      a?.setAttribute("intercept", String(-14 * th));
      bNode?.setAttribute("intercept", String(-14 * (th + 0.09)));
    },
  };
}

function crackOverlay(ghost: Ghost): HTMLElement {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 100 140");
  svg.setAttribute("preserveAspectRatio", "none");
  svg.setAttribute("class", "fx-crack");
  let d = "";
  for (let i = 0; i < 4; i += 1) {
    let x = 50 + (Math.random() - 0.5) * 24;
    let y = 55 + (Math.random() - 0.5) * 30;
    d += `M${x.toFixed(1)} ${y.toFixed(1)}`;
    const angle = (i / 4) * Math.PI * 2 + Math.random();
    for (let s = 0; s < 5; s += 1) {
      x += Math.cos(angle + (Math.random() - 0.5) * 1.1) * 14;
      y += Math.sin(angle + (Math.random() - 0.5) * 1.1) * 14;
      d += ` L${x.toFixed(1)} ${y.toFixed(1)}`;
    }
  }
  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute("d", d);
  svg.appendChild(path);
  ghost.inner.appendChild(svg);
  return svg as unknown as HTMLElement;
}

/** Crack flash (~90 ms) → noise dissolve with embers. Resolves when the ghost is fully gone. */
export async function dissolveGhost(ctx: FxContext, ghost: Ghost, rgb: string, startDelay = 0): Promise<boolean> {
  if (ctx.level === "reduced") {
    ctx.animate(ghost.outer, [{ opacity: 1 }, { opacity: 0 }], { duration: 220, delay: startDelay, fill: "both" });
    return ctx.wait(startDelay + 230);
  }
  if (!(await ctx.wait(startDelay))) return false;
  const box = ghost.outer.getBoundingClientRect();
  const engine = ctx.engine();
  crackOverlay(ghost);
  // Forward-filled lunge / brace animations on the inner layer would override inline filters
  // (root cause of "dead tokens stay visible"): freeze the current scale, then cancel them.
  const heldScale = getComputedStyle(ghost.inner).scale;
  for (const animation of ghost.inner.getAnimations()) animation.cancel();
  if (heldScale && heldScale !== "none") ghost.inner.style.scale = heldScale;
  ghost.inner.style.filter = "brightness(3.2) saturate(0.3)";
  engine?.emitFlash(ghost.center.x, ghost.center.y, "255,255,255", { radius: ghost.w * 0.9, duration: 0.22 });
  engine?.emitBurst(ghost.center.x, ghost.center.y, rgb, { count: 24, speed: 440, life: 0.5 });
  ctx.shake(2, 110);
  ctx.animate(
    ghost.inner,
    [{ scale: "1" }, { scale: "1.08", offset: 0.4 }, { scale: "1.03" }],
    { duration: 100, fill: "forwards", easing: "ease-out" },
  );
  if (!(await ctx.wait(90))) return false;
  const filter = dissolveFilter(ctx, rgb);
  filter.setProgress(0);
  ghost.inner.style.filter = `url(#${filter.id})`;
  engine?.emitEmbers(box.left, box.top, box.width, box.height, rgb, 30, 160);
  ctx.animate(
    ghost.inner,
    [{ translate: "0px 0px" }, { translate: "0px -12px" }],
    { duration: 520, easing: "ease-out", fill: "forwards" },
  );
  // Guarantee the token is clearly fading even where the noise mask is still mostly opaque.
  ctx.animate(
    ghost.outer,
    [{ opacity: 1, offset: 0 }, { opacity: 0.75, offset: 0.35 }, { opacity: 0, offset: 1 }],
    { duration: 520, easing: "ease-in", fill: "forwards" },
  );
  let second = false;
  const ok = await ctx.frames(500, (t) => {
    filter.setProgress(easeOut3(t) * 0.96 + t * 0.04);
    if (!second && t > 0.35) {
      second = true;
      engine?.emitEmbers(box.left, box.top, box.width, box.height * 0.7, rgb, 18, 190);
    }
  });
  filter.dispose();
  return ok;
}

export async function unitDied(ctx: FxContext, ev: Ev<"unit_died">, gen: CardGeneration, delay: number) {
  if (ev.inCombat) return;
  const entry = gen.get(ev.card.id);
  if (!entry) return;
  const live = liveCard(ev.card.id);
  if (live) ctx.hide(live);
  const release = ctx.own(() => live && ctx.show(live));
  const releasePile = holdPileTop(ctx, ev.card.id);
  if (!(await ctx.wait(delay))) return;
  const ghost = createGhost(ctx.stage, entry);
  const removeGhost = ctx.own(ghost.remove);
  ctx.number(ghost.center.x, ghost.center.y - ghost.h * 0.28, "", "damage", 0, { big: true, lethal: true });
  await dissolveGhost(ctx, ghost, rgbOf(ev.card).rgb);
  removeGhost();
  release();
  releasePile();
}

/* ------------------------------------------------------------------ combat clash */

/** Nominal (1x) phase lengths, shared with the director's timeline (see FxDirector.gapAfter). */
export const CLASH_WINDUP = 200;
export const CLASH_LUNGE = 130;
/** Impact lands this long after the clash starts. */
export const CLASH_IMPACT_AT = CLASH_WINDUP + CLASH_LUNGE;
/** Following events (conquer) start once the dissolves are ~this far underway. */
export const CLASH_DISSOLVE_LEAD = 380;

interface Actor {
  unit: ClashUnit;
  attacker: boolean;
  entry: CardEntry;
  live: HTMLElement | null;
  ghost?: Ghost;
  /** Offset applied during the lunge (px). */
  lunge: { x: number; y: number };
  rgb: string;
}

export async function combatClash(ctx: FxContext, ev: Ev<"combat_clash">, gen: CardGeneration, delay: number) {
  const actors: Actor[] = [];
  for (const [attacker, units] of [[true, ev.attackers], [false, ev.defenders]] as const) {
    for (const unit of units) {
      const prev = gen.get(unit.id);
      const live = liveCard(unit.id);
      const entry = prev ?? liveEntry(unit.id);
      if (!entry) continue;
      actors.push({ unit, attacker, entry, live, lunge: { x: 0, y: 0 }, rgb: rgbOf(unit.card).rgb });
    }
  }
  const attackers = actors.filter((actor) => actor.attacker).sort((a, b) => cx(a.entry.rect) - cx(b.entry.rect));
  const defenders = actors.filter((actor) => !actor.attacker).sort((a, b) => cx(a.entry.rect) - cx(b.entry.rect));
  if (attackers.length === 0 || defenders.length === 0) return;

  for (const actor of actors) {
    if (actor.live) ctx.hide(actor.live);
  }
  const pileReleases = actors.filter((actor) => actor.unit.died).map((actor) => ({ actor, release: holdPileTop(ctx, actor.unit.id) }));
  const releaseAll = ctx.own(() => {
    for (const actor of actors) if (actor.live) ctx.show(actor.live);
    for (const entry of pileReleases) entry.release();
  });

  const dmgNumber = (actor: Actor, order: number) => {
    if (actor.unit.damage <= 0) return;
    const rect = actor.ghost ? actor.ghost.outer.getBoundingClientRect() : actor.entry.rect;
    ctx.number(rect.left + rect.width / 2, rect.top + rect.height * 0.22, `-${actor.unit.damage}`, "damage", order * 45, {
      big: true,
      lethal: actor.unit.died,
    });
  };

  if (ctx.level === "reduced") {
    if (!(await ctx.wait(delay))) return;
    actors.forEach((actor, index) => {
      const live = liveCard(actor.unit.id);
      const box = actor.entry.rect;
      if (actor.unit.damage > 0) {
        ctx.number(cx(box), box.top + box.height * 0.22, `-${actor.unit.damage}`, "damage", index * 45, { big: true, lethal: actor.unit.died });
        if (live && !actor.unit.died) ctx.hitReaction(live, "red");
      }
    });
    await Promise.all(
      actors
        .filter((actor) => actor.unit.died)
        .map(async (actor) => {
          const ghost = createGhost(ctx.stage, actor.entry);
          const remove = ctx.own(ghost.remove);
          await dissolveGhost(ctx, ghost, actor.rgb);
          remove();
        }),
    );
    releaseAll();
    return;
  }

  if (!(await ctx.wait(delay))) return;

  // Ghosts for everyone, survivors cloned from their live (current) element.
  for (const actor of actors) {
    const source = actor.live ?? actor.entry.el;
    const ghost = createGhost(ctx.stage, { ...actor.entry, el: source }, actor.entry.rect);
    ghost.outer.style.zIndex = actor.attacker ? "3" : "2";
    ctx.own(ghost.remove);
    actor.ghost = ghost;
  }

  const sideAttack = ev.attackers[0] ? sideRgb(ctx, ev.attackers[0].playerId) : SIDE_COLORS.self.rgb;
  const sideDefend = ev.defenders[0] ? sideRgb(ctx, ev.defenders[0].playerId) : SIDE_COLORS.opponent.rgb;
  const centreOf = (actor: Actor) => actor.ghost!.center;

  // Pair up: pair k = attackers[k % nA] vs defenders[k % nD].
  const pairCount = Math.max(attackers.length, defenders.length);
  const pairs = Array.from({ length: pairCount }, (_, k) => ({
    a: attackers[k % attackers.length]!,
    d: defenders[k % defenders.length]!,
  }));
  const dirOf = (from: { x: number; y: number }, to: { x: number; y: number }) => {
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const len = Math.hypot(dx, dy) || 1;
    return { dx, dy, ux: dx / len, uy: dy / len, len };
  };
  const lungeOf = new Map<Actor, ReturnType<typeof dirOf>>();
  const braceOf = new Map<Actor, ReturnType<typeof dirOf>>();
  pairs.forEach((pair, k) => {
    if (k < attackers.length) lungeOf.set(pair.a, dirOf(centreOf(pair.a), centreOf(pair.d)));
    if (k < defenders.length) braceOf.set(pair.d, dirOf(centreOf(pair.d), centreOf(pair.a)));
  });

  const WINDUP = CLASH_WINDUP;
  const LUNGE = CLASH_LUNGE;
  const engine = ctx.engine();

  // Wind-up: attackers pull back and glow, defenders brace.
  for (const actor of attackers) {
    const v = lungeOf.get(actor);
    if (!v) continue;
    const back = { x: -v.ux * 28, y: -v.uy * 28 };
    actor.lunge = back;
    ctx.animate(actor.ghost!.outer, 
      [{ translate: "0px 0px" }, { translate: `${back.x}px ${back.y}px` }],
      { duration: WINDUP, easing: "cubic-bezier(0.3, 0, 0.3, 1)", fill: "forwards" },
    );
    ctx.animate(actor.ghost!.inner, 
      [{ scale: "1", filter: "none" }, { scale: "1.08", filter: `brightness(1.25) drop-shadow(0 0 16px rgba(${sideAttack},0.95))` }],
      { duration: WINDUP, easing: "ease-out", fill: "forwards" },
    );
    engine?.emitDust(actor.ghost!.center.x, actor.ghost!.center.y + actor.ghost!.h * 0.4, 4, actor.ghost!.w);
  }
  for (const actor of defenders) {
    const v = braceOf.get(actor);
    ctx.animate(actor.ghost!.inner, 
      [{ scale: "1", filter: "none" }, { scale: "0.96", filter: `drop-shadow(0 0 12px rgba(${sideDefend},0.8))` }],
      { duration: WINDUP, easing: "ease-out", fill: "forwards" },
    );
    if (v) {
      ctx.animate(actor.ghost!.outer, 
        [{ translate: "0px 0px" }, { translate: `${-v.ux * 7}px ${-v.uy * 7}px` }],
        { duration: WINDUP, easing: "ease-out", fill: "forwards" },
      );
    }
  }
  if (!(await ctx.wait(WINDUP))) return;

  // Lunge: attackers drive ~70% of the way, defenders counter-lunge ~16%.
  pairs.forEach((pair, k) => {
    const stagger = k * 35;
    const lunge = k < attackers.length ? lungeOf.get(pair.a) : undefined;
    if (lunge) {
      const to = { x: lunge.dx * 0.7, y: lunge.dy * 0.7 };
      ctx.animate(pair.a.ghost!.outer, 
        [{ translate: `${pair.a.lunge.x}px ${pair.a.lunge.y}px` }, { translate: `${to.x}px ${to.y}px` }],
        { duration: LUNGE, delay: stagger, easing: "cubic-bezier(0.55, 0, 0.95, 0.35)", fill: "forwards" },
      );
      ctx.animate(pair.a.ghost!.inner, 
        [{ scale: "1.08" }, { scale: "1.17" }],
        { duration: LUNGE, delay: stagger, easing: "ease-in", fill: "forwards" },
      );
      pair.a.lunge = to;
    }
    const brace = k < defenders.length ? braceOf.get(pair.d) : undefined;
    if (brace) {
      const to = { x: brace.dx * 0.16, y: brace.dy * 0.16 };
      ctx.animate(pair.d.ghost!.outer, 
        [{ translate: `${-brace.ux * 7}px ${-brace.uy * 7}px` }, { translate: `${to.x}px ${to.y}px` }],
        { duration: LUNGE, delay: stagger, easing: "cubic-bezier(0.55, 0, 0.95, 0.35)", fill: "forwards" },
      );
      ctx.animate(pair.d.ghost!.inner, 
        [{ scale: "0.96" }, { scale: "1.05" }],
        { duration: LUNGE, delay: stagger, easing: "ease-in", fill: "forwards" },
      );
      pair.d.lunge = to;
    }
  });

  // Impacts, one per pair.
  const numbered = new Set<Actor>();
  let numberOrder = 0;
  let shaken = false;
  const after: Array<Promise<unknown>> = [];
  const finished = new Set<Actor>();
  const impactPromises = pairs.map(async (pair, k) => {
    if (!(await ctx.wait(LUNGE + k * 35))) return;
    const a = centreOf(pair.a);
    const d = centreOf(pair.d);
    const v = dirOf(a, d);
    const point = { x: a.x + v.dx * 0.78, y: a.y + v.dy * 0.78 };
    const dmg = pair.d.unit.damage + pair.a.unit.damage;
    if (engine) {
      engine.emitFlash(point.x, point.y, "255,240,205", { radius: 150 + dmg * 12, duration: 0.3 });
      engine.emitBurst(point.x, point.y, "255,200,120", { count: 18 + dmg * 4, speed: 560, life: 0.5, gravity: 500 });
      engine.emitBurst(point.x, point.y, pair.a.rgb, { count: 12, speed: 420, life: 0.45 });
      engine.emitRing(point.x, point.y, "255,225,170", { radius: 110 + dmg * 9, from: 8, duration: 0.4, width: 7 });
    }
    if (!shaken) {
      shaken = true;
      ctx.shake(clamp(3 + ev.totalDamage * 0.7, 3.5, 14), 280);
    }
    for (const actor of [pair.d, pair.a]) {
      if (actor.unit.damage > 0 && !numbered.has(actor)) {
        numbered.add(actor);
        dmgNumber(actor, numberOrder++);
        engine?.emitBurst(centreOf(actor).x + actor.lunge.x, centreOf(actor).y + actor.lunge.y, "255,70,60", { count: 10, speed: 360, life: 0.4 });
      }
    }
    // Recoil.
    for (const actor of [pair.a, pair.d]) {
      const isA = actor === pair.a;
      const push = isA ? -1 : 1;
      const rest = isA ? { x: v.dx * 0.1, y: v.dy * 0.1 } : { x: v.ux * 12 + actor.lunge.x * 0.4, y: v.uy * 12 + actor.lunge.y * 0.4 };
      if (actor.unit.died) {
        ctx.animate(actor.ghost!.outer, 
          [{ translate: `${actor.lunge.x}px ${actor.lunge.y}px` }, { translate: `${actor.lunge.x + v.ux * 10 * (isA ? -1 : 1)}px ${actor.lunge.y + v.uy * 10 * (isA ? -1 : 1)}px` }],
          { duration: 120, easing: "ease-out", fill: "forwards" },
        );
        continue;
      }
      void push;
      ctx.animate(actor.ghost!.outer, 
        [{ translate: `${actor.lunge.x}px ${actor.lunge.y}px` }, { translate: `${rest.x}px ${rest.y}px` }],
        { duration: 260, easing: EASE.out, fill: "forwards" },
      );
      actor.lunge = rest;
      if (actor.unit.damage > 0) {
        ctx.animate(actor.ghost!.inner, 
          [{ filter: "brightness(2.6) saturate(0.4)" }, { filter: "brightness(1.5) saturate(1.6) hue-rotate(-14deg)", offset: 0.4 }, { filter: "none" }],
          { duration: 360, easing: "ease-out", fill: "forwards" },
        );
      }
    }
    // Deaths crack-flash and dissolve right at the impact; survivors recoil, then settle home.
    for (const actor of [pair.a, pair.d]) {
      if (finished.has(actor)) continue;
      finished.add(actor);
      if (actor.unit.died) {
        after.push(
          dissolveGhost(ctx, actor.ghost!, actor.rgb, 40).then((ok) => {
            actor.ghost?.remove();
            if (actor.live) ctx.show(actor.live);
            pileReleases.find((entry) => entry.actor === actor)?.release();
            return ok;
          }),
        );
        continue;
      }
      after.push(
        (async () => {
          if (!(await ctx.wait(330))) return;
          const ghost = actor.ghost!;
          const liveBox = actor.live ? boxOf(actor.live) : null;
          const target = liveBox ?? actor.entry.rect;
          const tx = cx(target) - ghost.center.x;
          const ty = cy(target) - ghost.center.y;
          ctx.animate(
            ghost.outer,
            [{ translate: `${actor.lunge.x}px ${actor.lunge.y}px` }, { translate: `${tx}px ${ty}px` }],
            { duration: 260, easing: EASE.out, fill: "forwards" },
          );
          ctx.animate(ghost.inner, [{ scale: "1.05" }, { scale: "1" }], { duration: 260, easing: EASE.out, fill: "forwards" });
          if (!(await ctx.wait(270))) return;
          if (actor.live) ctx.show(actor.live);
          ghost.remove();
        })(),
      );
    }
  });
  await Promise.all(impactPromises);
  await Promise.all(after);
  for (const actor of actors) actor.ghost?.remove();
  releaseAll();
}

export { DOMAIN_PALETTES, queryBox };
