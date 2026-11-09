/**
 * `recall` — rules 456–460 (to its base without a Move, 457/458; not blocked by movement
 * restrictions, 458.3; damage and statuses are unaffected, 460.1).
 */
import { recall } from "../../actions/move";
import { RESOLVED } from "../execute";
import { registerEffectOp } from "../registry";
import { recordOutcome, targets } from "../targets";

registerEffectOp("recall", (effect, context) => {
  if (effect.op !== "recall") return { status: "manual", reason: "effect_not_implemented:recall" };
  const found = targets(context, effect.target);
  if (!found.ok) return found.result;
  const done: string[] = [];
  for (const id of found.ids) {
    if (recall(context.room, id, context.step)) done.push(id);
  }
  recordOutcome(context, done, done.length > 0);
  return RESOLVED;
});
