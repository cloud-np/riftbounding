/** `rules_move` — rules 449–455 Standard Move. */
import { fail } from "../types";
import { moveTimingVerdict } from "../legality/move";
import { runCleanupOrQueue } from "../timing/fepr";
import { grantPriority } from "../state";
import { exhaust, movePrimitive } from "../actions/primitives";
import type { IntentContext, IntentResult } from "./context";

export function handleMove(context: IntentContext): IntentResult {
  const { room, rules, actorId, intent, host, step } = context;
  if (intent.type !== "rules_move") return fail("unknown_intent", "contract:§5");
  const verdict = moveTimingVerdict(room, actorId, intent.unitIds, String(intent.to), host);
  if (!verdict.ok) return verdict;
  for (const unitId of intent.unitIds) {
    exhaust(room, unitId, step); // 144.2: exhausting the Unit is the cost.
    const moved = movePrimitive(room, unitId, String(intent.to), step);
    if (!moved) return fail("invalid_location", "449.2", unitId);
  }
  // 455: when a Move action is complete, perform a Cleanup (starts the Showdown).
  runCleanupOrQueue(room, step);
  if (!rules.showdown && rules.turn.phase === "main" && !rules.priority) {
    grantPriority(rules, rules.turn.player);
  }
  return { ok: true };
}
