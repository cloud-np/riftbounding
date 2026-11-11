/**
 * Epic / legendary presentation for play and cast effects (owner request: "legendary cards and
 * epics should both have different effects with more impact"). Tier comes from
 * `card/rarity.ts`; common and rare cards never reach this module.
 *
 * - epic: violet arcane shockwave + rune-circle flash + particle burst, slightly longer showcase;
 * - legendary: golden pillar of light + god-rays, brief screen flash, slow-mo hold, embers,
 *   heavier shake and a title card with the card name.
 */
import type { CardInstance } from "@rift/protocol";

import { rarityTier, type RarityTier } from "../card/rarity";
import type { FxContext } from "./context";
import { el } from "./dom";

export const EPIC_RGB = "176,112,255";
export const LEGENDARY_RGB = "255,206,110";

export { rarityTier };
export type { RarityTier };

export const rarityRgb = (tier: RarityTier): string => (tier === "legendary" ? LEGENDARY_RGB : EPIC_RGB);

/** Extra nominal ms the card stays on screen (play hold / spell showcase) for each tier. */
export function rarityHold(tier: RarityTier | null): number {
  return tier === "legendary" ? 720 : tier === "epic" ? 320 : 0;
}

/** Extra timeline gap the director reserves after the event so effects don't pile up. */
export function rarityGap(tier: RarityTier | null): number {
  return tier === "legendary" ? 520 : tier === "epic" ? 220 : 0;
}

function overlay(ctx: FxContext, className: string, life: number, style: Record<string, string> = {}): HTMLElement {
  const node = el("div", className, ctx.top);
  for (const [key, value] of Object.entries(style)) {
    if (key.startsWith("--")) node.style.setProperty(key, value);
    else (node.style as unknown as Record<string, string>)[key] = value;
  }
  const remove = ctx.own(() => node.remove());
  void ctx.wait(life).then(remove);
  return node;
}

/** Title card with the card's name (legendary). */
function titleCard(ctx: FxContext, card: CardInstance, x: number, y: number, life: number) {
  const node = overlay(ctx, "fx-title-card", life, { left: `${x}px`, top: `${y}px`, "--fx-life": `${life}ms` });
  const kicker = el("span", "fx-title-kicker", node);
  kicker.textContent = "Legendary";
  const name = el("span", "fx-title-name", node);
  name.textContent = card.name;
}

/** Burst for a card slamming onto the board. `box` is the landing box, (x, y) the impact point. */
export function rarityPlayImpact(
  ctx: FxContext,
  tier: RarityTier,
  card: CardInstance,
  box: { left: number; top: number; width: number; height: number },
  x: number,
  y: number,
): void {
  if (ctx.level !== "full") return;
  const engine = ctx.engine();
  const rgb = rarityRgb(tier);
  const centre = { x: box.left + box.width / 2, y: box.top + box.height / 2 };
  const w = box.width;
  if (tier === "epic") {
    engine?.emitCircle(centre.x, centre.y, rgb, { radius: w * 1.5, duration: 0.9 });
    engine?.emitFlash(centre.x, centre.y, rgb, { radius: w * 2, duration: 0.45, alpha: 0.9 });
    engine?.emitRing(x, y, rgb, { radius: w * 3, from: w * 0.3, duration: 0.65, width: 9, squash: 0.45 });
    engine?.emitRing(x, y, "230,205,255", { radius: w * 2, from: w * 0.2, duration: 0.5, width: 4, squash: 0.45 });
    engine?.emitBurst(centre.x, centre.y, rgb, { count: 44, speed: 520, life: 0.8, gravity: 120, size: 3.4 });
    engine?.emitBurst(centre.x, centre.y, "235,215,255", { count: 16, speed: 300, life: 0.9, gravity: -60 });
    ctx.shake(4.5, 300, 7);
    ctx.thud(0.006, 380);
    return;
  }
  // legendary
  engine?.emitPillar(x, y, rgb, { height: Math.max(360, box.height * 4.5), width: w * 1.7, duration: 1.3 });
  engine?.emitFlash(centre.x, centre.y, rgb, { radius: w * 3, duration: 0.7, alpha: 1 });
  engine?.emitFlash(centre.x, centre.y, "255,255,240", { radius: w * 1.4, duration: 0.3, alpha: 0.9 });
  engine?.emitRing(x, y, rgb, { radius: w * 3.6, from: w * 0.3, duration: 0.8, width: 10, squash: 0.42 });
  engine?.emitRing(x, y, "255,244,205", { radius: w * 2.4, from: w * 0.2, duration: 0.6, width: 5, squash: 0.42 });
  engine?.emitBurst(centre.x, centre.y, rgb, { count: 56, speed: 640, life: 0.9, gravity: 260, size: 3.6 });
  engine?.emitEmbers(box.left - w * 0.4, box.top + box.height * 0.2, w * 1.8, box.height, rgb, 34, 170);
  overlay(ctx, "fx-godrays", 1500, {
    left: `${centre.x}px`,
    top: `${centre.y}px`,
    "--fx-rays": `${Math.max(420, w * 7)}px`,
    "--fx-life": "1500ms",
  });
  overlay(ctx, "fx-screen-flash", 520, { "--fx-rgb": rgb, "--fx-life": "520ms" });
  ctx.shake(8, 520, 6);
  ctx.thud(0.012, 520);
  titleCard(ctx, card, centre.x, Math.max(80, box.top - box.height * 0.9), 1700);
}

/** Showcase flourish when a spell is cast: runs once the card has landed at its showcase spot. */
export function rarityShowcase(
  ctx: FxContext,
  tier: RarityTier,
  card: CardInstance,
  x: number,
  y: number,
  height: number,
): void {
  if (ctx.level !== "full") return;
  const engine = ctx.engine();
  const rgb = rarityRgb(tier);
  const w = height / (88 / 63);
  if (tier === "epic") {
    engine?.emitCircle(x, y, rgb, { radius: height * 0.75, duration: 1.2 });
    engine?.emitRing(x, y, rgb, { radius: height * 1.1, from: w * 0.3, duration: 0.7, width: 9, squash: 0.6 });
    engine?.emitFlash(x, y, rgb, { radius: height, duration: 0.5, alpha: 0.9 });
    engine?.emitBurst(x, y, rgb, { count: 46, speed: 460, life: 0.9, gravity: 60 });
    ctx.shake(3.5, 260, 7);
    return;
  }
  engine?.emitPillar(x, y + height * 0.5, rgb, { height: height * 2.6, width: w * 1.6, duration: 1.4 });
  engine?.emitFlash(x, y, rgb, { radius: height * 1.4, duration: 0.8 });
  engine?.emitRing(x, y, rgb, { radius: height * 1.3, from: w * 0.3, duration: 0.8, width: 10, squash: 0.6 });
  engine?.emitBurst(x, y, rgb, { count: 60, speed: 560, life: 1, gravity: 120, size: 3.6 });
  engine?.emitEmbers(x - w, y - height * 0.3, w * 2, height, rgb, 36, 160);
  overlay(ctx, "fx-godrays", 1700, { left: `${x}px`, top: `${y}px`, "--fx-rays": `${height * 2.6}px`, "--fx-life": "1700ms" });
  overlay(ctx, "fx-screen-flash", 520, { "--fx-rgb": rgb, "--fx-life": "520ms" });
  ctx.shake(7, 460, 6);
  ctx.thud(0.01, 480);
  titleCard(ctx, card, x, Math.max(80, y - height * 0.75), 1900);
}
