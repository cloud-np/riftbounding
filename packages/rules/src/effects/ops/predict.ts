/**
 * `predict` — rule 437 (and Vision, 817).
 *
 * 437.1: look at the top card(s) of the Main Deck and choose which to recycle; 437.1.a: the rest
 * go back on top. 437.3.a: X defaults to 1. 437.4/437.4.a: with fewer cards, predict as many as
 * possible and never Burn Out.
 * TODO(R2-effects): 437.1.a lets the player reorder the cards kept on top; they keep their order.
 */
import { pushEvent } from "../../types";
import { RESOLVED } from "../execute";
import { registerEffectOp } from "../registry";
import { optionFor, recordOutcome } from "../targets";
import { amountOf, ctxOf, hostOf, playersOf } from "./util";

registerEffectOp("predict", (effect, context) => {
  if (effect.op !== "predict") return { status: "manual", reason: "effect_not_implemented:predict" };
  const host = hostOf(context);
  const ctx = ctxOf(context);
  const machine = context.machine;
  const amount = Math.max(1, amountOf(context, effect.amount) ?? 1);
  const playerId = playersOf(context, effect.player)[0];
  if (!playerId) return RESOLVED;
  const top = host.lookAtTop(context.room, playerId, "deck", amount).map((card) => card.id);
  if (top.length === 0) {
    recordOutcome(context, [], false);
    return RESOLVED;
  }
  let recycle: string[];
  if (machine && machine.frame.answer !== undefined) {
    const answer = machine.frame.answer;
    recycle = (Array.isArray(answer) ? answer : [answer]).filter(
      (id): id is string => typeof id === "string" && top.includes(id),
    );
    machine.frame.answer = undefined;
  } else if (machine) {
    return machine.ask({
      kind: "choose-card",
      playerId,
      options: top.map((id) => optionFor(ctx, id)),
      min: 0,
      max: top.length,
      rule: "437.1",
      promptKey: "rules.prompt.predictRecycle",
      data: { answer: "objects" },
    });
  } else {
    recycle = [];
  }
  for (const id of recycle) {
    host.moveCardTo(context.room, playerId, "deck", "deck", id, "bottom");
  }
  pushEvent(context.step.events, {
    type: "predict",
    playerId,
    amount: top.length,
    data: { recycled: recycle.length },
  });
  recordOutcome(context, recycle, true);
  return RESOLVED;
});
