/**
 * `gain_xp` / `spend_xp` — XP 728–733 (730.1 gain increases, 730.2 spend reduces; 733 no
 * limit). Spending more XP than the player has is impossible: the instruction is negated.
 */
import { pushEvent } from "../../types";
import { interceptAction } from "../../timing/hooks";
import { RESOLVED } from "../execute";
import { setXp, xpOf } from "../evaluate";
import { registerEffectOp } from "../registry";
import { recordOutcome } from "../targets";
import { amountOf, playersOf } from "./util";

registerEffectOp("gain_xp", (effect, context) => {
  if (effect.op !== "gain_xp") return { status: "manual", reason: "effect_not_implemented:gain_xp" };
  const amount = Math.max(0, amountOf(context, effect.amount) ?? 0);
  let gained = false;
  for (const playerId of playersOf(context, effect.player)) {
    if (amount <= 0) continue;
    const proposal = interceptAction(context.room, context.step, { type: "gain_xp", playerId, amount });
    if (!proposal) continue;
    const value = Math.max(0, Math.trunc(proposal.amount ?? amount));
    setXp(context.room, playerId, xpOf(context.room, playerId) + value);
    gained = true;
    pushEvent(context.step.events, { type: "gain_xp", playerId, amount: value, data: { xp: xpOf(context.room, playerId) } });
  }
  recordOutcome(context, [], gained);
  return RESOLVED;
});

registerEffectOp("spend_xp", (effect, context) => {
  if (effect.op !== "spend_xp") return { status: "manual", reason: "effect_not_implemented:spend_xp" };
  const amount = Math.max(0, amountOf(context, effect.amount) ?? 0);
  let spent = true;
  for (const playerId of playersOf(context, effect.player)) {
    const current = xpOf(context.room, playerId);
    if (current < amount) {
      spent = false;
      continue;
    }
    setXp(context.room, playerId, current - amount);
    pushEvent(context.step.events, { type: "spend_xp", playerId, amount, data: { xp: current - amount } });
  }
  recordOutcome(context, [], spent);
  return RESOLVED;
});
