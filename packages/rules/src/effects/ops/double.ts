/**
 * `double` — rule 433.
 *
 * 433.1/433.1.a: increase a numeric attribute by its current value for the effect's duration
 * (Might: "this turn", EX[222]). 479.4.c: an increase by a negative amount is 0 (EX[258]).
 * Points: gain points equal to the current score (470.2 "gain").
 * TODO(R2-effects): 433.1.b damage doubling is a replacement effect (not expressible yet).
 */
import { pushEvent } from "../../types";
import { gainPoints } from "../../actions/score";
import { addMight } from "../../layers/mods";
import { rawMight } from "../../layers";
import { RESOLVED } from "../execute";
import { registerEffectOp } from "../registry";
import { recordOutcome, targets } from "../targets";
import { ctxOf, hostOf, isOnBoard } from "./util";
import { controllerOf } from "../objects";

registerEffectOp("double", (effect, context) => {
  if (effect.op !== "double") return { status: "manual", reason: "effect_not_implemented:double" };
  const property = effect.property ?? "might";
  if (property === "damage") return { status: "manual", reason: "effect_not_implemented:double_damage" };
  const found = targets(context, effect.target);
  if (!found.ok) return found.result;
  const host = hostOf(context);
  const ctx = ctxOf(context);
  const done: string[] = [];
  for (const id of found.ids) {
    if (!isOnBoard(context.room, host, id)) continue;
    if (property === "points") {
      const player = controllerOf(context.room, host, id);
      if (!player) continue;
      gainPoints(context.room, player, host.score(context.room, player), context.step);
      done.push(id);
      continue;
    }
    const increase = Math.max(0, rawMight(context.room, id, host));
    if (increase === 0) continue;
    addMight(context.room, host, id, increase, "this-turn", ctx.env.controller, ctx.env.sourceObjectId);
    done.push(id);
    pushEvent(context.step.events, { type: "might", cardId: id, amount: increase, data: { doubled: true } });
  }
  recordOutcome(context, done, done.length > 0);
  return RESOLVED;
});
