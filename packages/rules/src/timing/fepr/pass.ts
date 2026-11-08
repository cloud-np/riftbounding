/** Pass Priority — rules 338.1.b / 339. */
import type { Room } from "@rift/protocol";
import type { RulesStepContext } from "../../types";
import { pushEvent } from "../../types";
import { clearPasses, grantPriority, nextPlayerInTurnOrder } from "../../state";
import { resolveNewest } from "./resolve";

/**
 * 338.1.b / 339: pass Priority in sequence. Returns the player who receives Priority next, or
 * null when the chain resolved / the window closed.
 */
export function passPriority(room: Room, playerId: string, step: RulesStepContext): boolean {
  const rules = room.rules;
  if (!rules) return false;
  if (rules.priority !== playerId) return false;
  if (rules.chain.length === 0) return false;
  // 338.1.b.1: pass to the next player in Turn Order.
  const active = step.host.activePlayerIds(room);
  const passes = new Set(rules.passes);
  passes.add(playerId);
  rules.passes = [...passes];
  pushEvent(step.events, { type: "pass_priority", playerId });
  if (active.every((id) => passes.has(id))) {
    // 339.1 / 340.1: everyone passed in sequence without adding an item → resolve.
    resolveNewest(room, step);
    clearPasses(rules);
    return true;
  }
  const next = nextPlayerInTurnOrder(room, playerId, step.host);
  if (next) grantPriority(rules, next);
  return true;
}
