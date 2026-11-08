/**
 * Layers — rules 475–479.
 *
 * Effective characteristics are computed from the base/printed value plus every continuous
 * modifier that applies. R1 only has the object-level modifiers already stored on
 * `rules.objects[id]`; R2-effects widens this module (and only this module) to read
 * `rules.effects` / `Modifier`s. Every consumer goes through the helpers below so a granted
 * keyword or temporary Might buff is visible to timing, combat and cleanups alike.
 *
 * Pure: no mutation, no Date/rng; the room is only read.
 */
import type { Room } from "@rift/protocol";
import type { RulesHost } from "../host";

/** 143.2: effective Might = printed/base + temporary buffs + buff counters. */
export function effectiveMight(room: Room, cardId: string, host: RulesHost): number {
  const objects = room.rules?.objects[cardId];
  const info = host.cardInfo(room, cardId);
  const base = objects?.baseMight ?? info?.might ?? 0;
  const objectMight = objects?.temporaryMight ?? 0;
  const buffs = objects?.buffs ?? 0;
  return Math.max(0, base + objectMight + buffs);
}

/**
 * Where printed keywords come from. The host form `(room, objectId, host)` is the public
 * signature; the array form lets callers that already hold a `CardInfo` (legality/timing) avoid
 * a second host lookup without duplicating the granted-keyword layer.
 */
export type KeywordSource = RulesHost | readonly string[];

/**
 * 475–479 (keyword layer): the card's printed keywords plus `rules.objects[id].grantedKeywords`.
 * Comparison is case-insensitive and keeps the first spelling, so granting "Action" to a card
 * that already has `[Action]` does not produce a duplicate.
 */
export function effectiveKeywords(room: Room, objectId: string, source: KeywordSource): string[] {
  const printed = Array.isArray(source)
    ? [...source]
    : ((source as RulesHost).cardInfo(room, objectId)?.keywords ?? []);
  const granted = room.rules?.objects[objectId]?.grantedKeywords ?? [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const keyword of [...printed, ...granted]) {
    if (typeof keyword !== "string") continue;
    const key = keyword.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(keyword);
  }
  return out;
}
