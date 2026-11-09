/** `ready` — rule 416 (416.1.b/c: a ready object is not readied again). */
import { ready } from "../../actions/ready";
import { restrictionFor } from "../../layers/restrictions";
import { RESOLVED } from "../execute";
import { registerEffectOp } from "../registry";
import { recordOutcome, targets } from "../targets";
import { hostOf, isOnBoard } from "./util";

registerEffectOp("ready", (effect, context) => {
  if (effect.op !== "ready") return { status: "manual", reason: "effect_not_implemented:ready" };
  const found = targets(context, effect.target);
  if (!found.ok) return found.result;
  const host = hostOf(context);
  const done: string[] = [];
  for (const id of found.ids) {
    if (!isOnBoard(context.room, host, id) || host.isExhausted(context.room, id) === false) continue;
    // 054: "can't be readied" beats the instruction (the instruction is negated).
    if (restrictionFor(context.room, host, { kind: "ready", objectId: id })) continue;
    if (ready(context.room, id, context.step)) done.push(id);
  }
  recordOutcome(context, done, done.length > 0);
  return RESOLVED;
});
