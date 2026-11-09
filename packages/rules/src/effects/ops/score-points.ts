/** `score_points` — 470.2: "Score X points" on card text means Gain X points (not the Scoring process). */
import { gainPoints } from "../../actions/score";
import { RESOLVED } from "../execute";
import { registerEffectOp } from "../registry";
import { recordOutcome } from "../targets";
import { amountOf, playersOf } from "./util";

registerEffectOp("score_points", (effect, context) => {
  if (effect.op !== "score_points") return { status: "manual", reason: "effect_not_implemented:score_points" };
  const amount = Math.max(0, amountOf(context, effect.amount) ?? 0);
  let gained = 0;
  if (amount > 0) {
    for (const playerId of playersOf(context, effect.player)) {
      gained += gainPoints(context.room, playerId, amount, context.step);
    }
  }
  recordOutcome(context, [], gained > 0);
  return RESOLVED;
});
