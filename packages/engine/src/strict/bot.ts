/**
 * Strict-mode bot helper for the engine package.
 *
 * The pure picker lives in `@rift/rules` and needs a `RulesHost` (board facts live in `Room`).
 * This module binds the engine's strict host and keeps the engine's read context deterministic
 * (`@rift/rules` itself never reads the clock or an unseeded RNG).
 *
 * Read-only: like `strict/view.ts`, any unexpected throw (a redacted placeholder, a partially
 * restored room, …) degrades to `null` instead of breaking the caller.
 */
import type { Room, RulesIntent } from "@rift/protocol";
import { pickRandomAction, type RulesContext } from "@rift/rules";
import { createEngineRulesHost } from "./host";

function readContext(room: Room): RulesContext {
  return {
    now: room.updatedAt ?? 0,
    rng: () => 0,
    mode: room.roomMode ?? "multiplayer",
  };
}

/**
 * Pick one legal strict intent for `playerId`, or `null` when the player cannot act.
 *
 * `room` must be the bot seat's redacted view in live play; `random` is the injected seeded
 * PRNG (never `Math.random`).
 */
export function pickStrictBotAction(
  room: Room,
  playerId: string,
  random: () => number,
): RulesIntent | null {
  if (room.rulesMode !== "strict" || room.phase !== "in_game" || !room.rules) return null;
  try {
    return pickRandomAction(room, playerId, createEngineRulesHost(readContext(room)), random);
  } catch {
    return null;
  }
}
