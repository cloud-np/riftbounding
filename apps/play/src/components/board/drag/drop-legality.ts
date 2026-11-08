/**
 * Drop legality + ordered drop-index helpers.
 *
 * The engine does not publicly export `canCardGoToZone`/`moveCard` (they live in
 * `@rift/engine/src/rules/movement.ts`), so `engineCanDrop` dry-runs the real
 * transition function on the projected room: the authoritative engine is the
 * single source of truth for the drop highlight. `canDropLocally` is only a
 * cheap pre-filter/fallback for zones the transition function cannot express.
 */
import { applyGameAction } from "@rift/engine";
import type { Room } from "@rift/protocol";

import type { GameActionIntent } from "../slot-types";

export interface DropRect {
  left: number;
  right: number;
  top: number;
  bottom: number;
  width: number;
  height: number;
}

/** Number of card midpoints the pointer has passed (clamped to `rects.length`). */
export function computeOrderedDropIndex(
  rects: readonly DropRect[],
  clientX: number,
  clientY: number,
  orientation: "horizontal" | "vertical" = "horizontal",
): number {
  let index = 0;
  for (const rect of rects) {
    const mid = orientation === "horizontal" ? rect.left + rect.width / 2 : rect.top + rect.height / 2;
    const value = orientation === "horizontal" ? clientX : clientY;
    const crossMid = orientation === "horizontal" ? rect.top + rect.height / 2 : rect.left + rect.width / 2;
    const crossValue = orientation === "horizontal" ? clientY : clientX;
    const crossDistance = Math.abs(crossValue - crossMid);
    // Pointer far outside the column/row still counts using the main axis; the
    // tolerance just keeps a finger between two fans from jumping backwards.
    if (value > mid || crossDistance > (orientation === "horizontal" ? rect.height * 2 : rect.width * 2)) {
      index += 1;
    }
  }
  return Math.max(0, Math.min(rects.length, index));
}

/** Cheap rules mirroring the engine's `canCardGoToZone` for obvious cases. */
export function canDropLocally(input: {
  from: string;
  to: string;
  type?: string;
  hidden?: boolean;
  sameZone?: boolean;
}): boolean {
  const { from, to } = input;
  const type = input.type ?? "";
  const spell = /spell/i.test(type);
  if (to === "legend") return false;
  if (to === "runeArea") return from === "runeArea";
  if (from === "runeArea" && to !== "runeArea" && to !== "runeDeck") return false;
  if (spell && (to === "base" || to.startsWith("battlefield"))) return false;
  if (to === "champion" && from !== "champion") return false;
  return true;
}

const dryRunCache = new WeakMap<Room, Map<string, boolean>>();

/** Dry-run the authoritative engine transition to test one drop. */
export function engineCanDrop(state: Room, actorPlayerId: string, intent: GameActionIntent): boolean {
  if (intent.type !== "move_card" && intent.type !== "chain_add" && intent.type !== "send_to_deck") {
    return true;
  }
  let byKey = dryRunCache.get(state);
  if (!byKey) {
    byKey = new Map();
    dryRunCache.set(state, byKey);
  }
  const key = `${actorPlayerId}:${JSON.stringify(intent)}`;
  const cached = byKey.get(key);
  if (cached !== undefined) return cached;
  let allowed = true;
  try {
    const result = applyGameAction(state, actorPlayerId, intent, {
      now: 1_700_000_000_000,
      rng: () => 0.5,
      mode: "solo_lab",
    });
    allowed = result.ok && result.state !== state;
  } catch {
    allowed = false;
  }
  byKey.set(key, allowed);
  return allowed;
}
