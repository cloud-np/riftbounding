/**
 * `stun` — rule 424 (424.1.a.1: a stunned unit cannot be stunned again — no event, no trigger,
 * EX[207]; 424.1.a.2: cleared in step 3d of the end-of-turn cleanup).
 */
import { pushEvent } from "../../types";
import { interceptAction } from "../../timing/hooks";
import { RESOLVED } from "../execute";
import { registerEffectOp } from "../registry";
import { recordOutcome, targets } from "../targets";
import { hostOf, isOnBoard } from "./util";
import { isUnit } from "../objects";

registerEffectOp("stun", (effect, context) => {
  if (effect.op !== "stun") return { status: "manual", reason: "effect_not_implemented:stun" };
  const found = targets(context, effect.target);
  if (!found.ok) return found.result;
  const host = hostOf(context);
  const rules = context.room.rules;
  const done: string[] = [];
  for (const id of found.ids) {
    if (!rules || !isOnBoard(context.room, host, id) || !isUnit(context.room, host, id)) continue;
    if (rules.objects[id]?.stunned) continue;
    if (!interceptAction(context.room, context.step, { type: "stun", cardId: id })) continue;
    (rules.objects[id] ??= {}).stunned = true;
    done.push(id);
    pushEvent(context.step.events, {
      type: "stun",
      cardId: id,
      playerId: context.controller,
      ...(context.machine?.env.sourceObjectId ? { sourceObjectId: context.machine.env.sourceObjectId } : {}),
    });
  }
  recordOutcome(context, done, done.length > 0);
  return RESOLVED;
});
