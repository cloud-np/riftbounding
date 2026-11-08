/** `draw` — rule 414 (414.4: draw as many as possible, Burn Out, draw the rest; 432.1.a). */
import { drawCards } from "../../actions/draw";
import { RESOLVED } from "../execute";
import { registerEffectOp } from "../registry";
import { recordOutcome } from "../targets";
import { amountOf, playersOf } from "./util";

registerEffectOp("draw", (effect, context) => {
  if (effect.op !== "draw") return { status: "manual", reason: "effect_not_implemented:draw" };
  const amount = amountOf(context, effect.amount);
  if (amount === null || amount <= 0) {
    recordOutcome(context, [], false);
    return RESOLVED;
  }
  const drawn: string[] = [];
  for (const playerId of playersOf(context, effect.player)) {
    const result = drawCards(context.room, playerId, amount, context.step);
    drawn.push(...result.drawn);
    // TODO(R2-effects): a 3+ player Burn Out prompt (432.2.c) completes the draw in its own
    // handler; the rest of this resolution continues without waiting for it.
  }
  recordOutcome(context, drawn, drawn.length > 0);
  return RESOLVED;
});
