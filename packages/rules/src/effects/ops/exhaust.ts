/** `exhaust` — rule 415 (415.1.b/c: an exhausted object is not exhausted again). */
import { exhaust } from "../../actions/ready";
import { RESOLVED } from "../execute";
import { registerEffectOp } from "../registry";
import { recordOutcome, targets } from "../targets";
import { hostOf, isOnBoard } from "./util";

registerEffectOp("exhaust", (effect, context) => {
  if (effect.op !== "exhaust") return { status: "manual", reason: "effect_not_implemented:exhaust" };
  const found = targets(context, effect.target);
  if (!found.ok) return found.result;
  const host = hostOf(context);
  const done: string[] = [];
  for (const id of found.ids) {
    // 415.1: only non-spell objects on the board; 415.1.c: already exhausted → nothing happens.
    if (!isOnBoard(context.room, host, id) || host.isExhausted(context.room, id)) continue;
    if (exhaust(context.room, id, context.step)) done.push(id);
  }
  recordOutcome(context, done, done.length > 0);
  return RESOLVED;
});
