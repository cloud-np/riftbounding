/**
 * `pay` — rule 445, through R2-play's `payCost` (`play/payment.ts` contract).
 *
 * 445.2: if the player does not (or cannot) pay, the instruction is negated; dependent
 * "if you do" instructions read `$did` (359.3.e.14.b).
 */
import { payCost } from "../../play/payment";
import { RESOLVED } from "../execute";
import { registerEffectOp } from "../registry";
import { recordOutcome } from "../targets";
import { playersOf } from "./util";

registerEffectOp("pay", (effect, context) => {
  if (effect.op !== "pay") return { status: "manual", reason: "effect_not_implemented:pay" };
  let paidAll = true;
  for (const playerId of playersOf(context, effect.player)) {
    const source = context.machine?.env.sourceObjectId;
    const verdict = payCost(context.room, context.step, playerId, effect.cost, source ? { sourceObjectId: source } : undefined);
    if (!verdict.ok) paidAll = false;
  }
  recordOutcome(context, [], paidAll);
  return RESOLVED;
});
