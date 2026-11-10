/** Ready / Exhaust — rules 415–416; the Awaken Phase ready 315.1.b / 416.3.a. */
import type { Room } from "@rift/protocol";
import type { RulesStepContext } from "../types";
import { pushEvent } from "../types";
import { interceptAction } from "../timing/hooks";
import { restrictionFor } from "../layers/restrictions";

/**
 * 416: ready one object. 416.1.b/416.1.c: an object that is already ready is not readied again —
 * nothing happens and no `ready` event is emitted (so "when I become ready" cannot trigger).
 * `playerId` is the player responsible for the action (412.4) when one is known.
 */
export function ready(room: Room, cardId: string, step: RulesStepContext, playerId?: string): boolean {
  // 367–375: replacement effects may prevent or replace the game action before it happens.
  if (!interceptAction(room, step, { type: "ready", cardId, ...(playerId ? { playerId } : {}) })) return false;
  if (step.host.isExhausted(room, cardId) !== true) return false;
  const changed = step.host.setExhausted(room, cardId, false);
  if (changed) pushEvent(step.events, { type: "ready", cardId, ...(playerId ? { playerId } : {}) });
  return changed;
}

/** 415: exhaust one object. 415.1.c: an object that is already exhausted is not exhausted again. */
export function exhaust(room: Room, cardId: string, step: RulesStepContext): boolean {
  if (!interceptAction(room, step, { type: "exhaust", cardId })) return false;
  if (step.host.isExhausted(room, cardId) === true) return false;
  const changed = step.host.setExhausted(room, cardId, true);
  if (changed) pushEvent(step.events, { type: "exhaust", cardId });
  return changed;
}

/** 315.1.b: the board zones whose Game Objects the Turn Player readies (Bases, Battlefields, Legend, Runes). */
const AWAKEN_ZONES = [
  "legend",
  "runeArea",
  "base",
  "battlefieldA",
  "battlefieldB",
  "battlefieldC",
  "battlefieldToken",
] as const;

/**
 * 315.1.b / 416.3.a: "A player Readies all non-spell Game Objects they Control during the
 * Awakening Phase." Each object is Readied individually, so
 * - 054.1: an object that "can't be readied" stays exhausted (e.g. Maduli the Gatekeeper);
 * - 416.1.b: only exhausted objects ready;
 * - every object that becomes ready emits its own `ready` event with the Turn Player as the
 *   responsible player (412.4), so "when I become ready" / "when you ready …" abilities trigger
 *   exactly as they do for an effect-driven ready (416.3.b).
 * A facedown card is not a Game Object at its battlefield (107.3): it is readied silently.
 */
export function readyAll(room: Room, playerId: string, step: RulesStepContext): number {
  if (!interceptAction(room, step, { type: "ready_all", playerId })) return 0;
  let count = 0;
  for (const zone of AWAKEN_ZONES) {
    for (const card of [...step.host.zoneCards(room, playerId, zone)]) {
      if (!card.exhausted) continue;
      if (restrictionFor(room, step.host, { kind: "ready", objectId: card.id })) continue;
      if (card.hidden) {
        if (step.host.setExhausted(room, card.id, false)) count += 1;
        continue;
      }
      if (ready(room, card.id, step, playerId)) count += 1;
    }
  }
  pushEvent(step.events, { type: "ready_all", playerId, amount: count });
  return count;
}
