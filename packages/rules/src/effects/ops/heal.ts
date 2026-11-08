/** `heal` — rule 419 (damage cleared from units is Healing; several units at once, 419.2). */
import { heal } from "../../actions/damage";
import { RESOLVED } from "../execute";
import { registerEffectOp } from "../registry";
import { recordOutcome, targets } from "../targets";
import { amountOf } from "./util";

/** "Heal it" without a number clears all damage. */
const ALL = 9999;

registerEffectOp("heal", (effect, context) => {
  if (effect.op !== "heal") return { status: "manual", reason: "effect_not_implemented:heal" };
  const found = targets(context, effect.target);
  if (!found.ok) return found.result;
  const amount = amountOf(context, effect.amount) ?? ALL;
  const done: string[] = [];
  for (const id of found.ids) {
    if (heal(context.room, id, amount, context.step) > 0) done.push(id);
  }
  recordOutcome(context, done, done.length > 0);
  return RESOLVED;
});
