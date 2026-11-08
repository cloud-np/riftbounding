/** Ready / Exhaust — rules 415–416. */
import type { Room } from "@rift/protocol";
import type { RulesStepContext } from "../types";
import { pushEvent } from "../types";
import { interceptAction } from "../timing/hooks";

export function ready(room: Room, cardId: string, step: RulesStepContext): boolean {
  // 367–375: replacement effects may prevent or replace the game action before it happens.
  if (!interceptAction(room, step, { type: "ready", cardId })) return false;
  const changed = step.host.setExhausted(room, cardId, false);
  if (changed) pushEvent(step.events, { type: "ready", cardId });
  return changed;
}

export function exhaust(room: Room, cardId: string, step: RulesStepContext): boolean {
  if (!interceptAction(room, step, { type: "exhaust", cardId })) return false;
  const changed = step.host.setExhausted(room, cardId, true);
  if (changed) pushEvent(step.events, { type: "exhaust", cardId });
  return changed;
}

export function readyAll(room: Room, playerId: string, step: RulesStepContext): number {
  if (!interceptAction(room, step, { type: "ready_all", playerId })) return 0;
  const count = step.host.readyAll(room, playerId);
  pushEvent(step.events, { type: "ready_all", playerId, amount: count });
  return count;
}
