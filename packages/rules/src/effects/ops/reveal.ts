/**
 * `reveal` — rule 425 (cards stay in their zone, 425.1.a.2; known to all players).
 * TODO(R2-effects): 425.1.a.3 — end the Revealed state when the resolution finishes.
 */
import { pushEvent } from "../../types";
import { RESOLVED } from "../execute";
import { registerEffectOp } from "../registry";
import { recordOutcome, targets } from "../targets";
import { hostOf } from "./util";

registerEffectOp("reveal", (effect, context) => {
  if (effect.op !== "reveal") return { status: "manual", reason: "effect_not_implemented:reveal" };
  const found = targets(context, effect.target);
  if (!found.ok) return found.result;
  const host = hostOf(context);
  const done: string[] = [];
  for (const id of found.ids) {
    if (!host.reveal(context.room, id)) continue;
    done.push(id);
    pushEvent(context.step.events, { type: "reveal", cardId: id, playerId: context.controller });
  }
  recordOutcome(context, done, done.length > 0);
  return RESOLVED;
});
