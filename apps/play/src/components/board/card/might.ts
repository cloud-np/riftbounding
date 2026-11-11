import { strictEffectiveMight } from "@rift/engine";
import type { CardInstance, Room } from "@rift/protocol";

import { cardMeta, currentMight } from "./card-meta";

export type MightState = "buffed" | "debuffed" | "damaged" | null;

export interface UnitMightView {
  /** Printed (catalog) Might, when known. */
  printed: number | undefined;
  /** Might the unit currently has: the rules engine's `effectiveMight` in strict rooms. */
  current: number | undefined;
  /** Damage marked on the unit this turn. */
  damage: number;
  /** Damage wins over the buff tint; `trend` still tells whether the number is up or down. */
  state: MightState;
  trend: "up" | "down" | null;
}

/**
 * Single source of truth for the Might a unit shows. Strict rooms ask the rules engine
 * (`effectiveMight`: equipment, layered modifiers, designations, buffs); sandbox rooms keep the
 * simple printed + buffs computation. Never throws on hidden / partial objects.
 */
export function unitMightView(room: Room | null | undefined, card: CardInstance): UnitMightView {
  let printed: number | undefined;
  let current: number | undefined;
  let damage = 0;
  try {
    printed = cardMeta(card).might;
    const object = room?.rules?.objects?.[card.id];
    const dmg = Math.trunc(Number(object?.damage ?? 0));
    damage = Number.isFinite(dmg) && dmg > 0 ? dmg : 0;
    const strict = strictEffectiveMight(room, card.id);
    current = strict !== null ? Math.max(0, strict) : currentMight(printed, card, object);
  } catch {
    current = printed;
  }
  const trend =
    current !== undefined && printed !== undefined && current !== printed ? (current > printed ? "up" : "down") : null;
  const state: MightState = damage > 0 ? "damaged" : trend === "up" ? "buffed" : trend === "down" ? "debuffed" : null;
  return { printed, current, damage, state, trend };
}
