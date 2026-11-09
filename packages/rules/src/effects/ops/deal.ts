/**
 * `deal` — rule 418, Bonus Damage 712–715.
 *
 * 418.1.b: mark damage on each target separately (418.1.c), possibly several at once (418.1.d).
 * 418.1.e: only Valid Damage (≥ 1) is dealt. 418.6.a: without a named source, the effect's
 * source is the source. 418.8: "deal X for each" is one instance. 714/715: Bonus Damage is
 * summed once and added to each target individually (715.2); none applies when no damage would
 * be dealt (715.4). Prevention/replacement (438, 367–375) is applied by the `deal_damage`
 * interceptor inside `dealDamage`.
 */
import { dealDamage } from "../../actions/damage";
import { bonusDamage } from "../../layers/bonus";
import { restrictionFor } from "../../layers/restrictions";
import { RESOLVED } from "../execute";
import { resolveSelector } from "../evaluate";
import { registerEffectOp } from "../registry";
import { recordOutcome, targets } from "../targets";
import { amountOf, ctxOf, hostOf, isOnBoard } from "./util";
import { isUnit } from "../objects";

registerEffectOp("deal", (effect, context) => {
  if (effect.op !== "deal") return { status: "manual", reason: "effect_not_implemented:deal" };
  const ctx = ctxOf(context);
  const host = hostOf(context);
  const found = targets(context, effect.target);
  if (!found.ok) return found.result;
  const amount = amountOf(context, effect.amount);
  // 359.3.e.12: unavailable information (e.g. a mistargeted unit's Might) ignores the instruction.
  if (amount === null || found.ids.length === 0) {
    recordOutcome(context, [], false);
    return RESOLVED;
  }
  const sources = effect.source ? resolveSelector(ctx, effect.source) : [];
  const sourceId = sources[0] ?? ctx.env.sourceObjectId;
  // 715.4: Bonus Damage only augments an actual deal action.
  const bonus =
    amount >= 1
      ? bonusDamage(context.room, host, {
          controller: ctx.env.controller,
          ...(sourceId ? { sourceObjectId: sourceId } : {}),
          ...(ctx.env.kind ? { kind: ctx.env.kind } : {}),
        })
      : 0;
  const done: string[] = [];
  for (const id of found.ids) {
    if (!isOnBoard(context.room, host, id) || !isUnit(context.room, host, id)) continue;
    if (restrictionFor(context.room, host, { kind: "be-dealt-damage", objectId: id, ...(sourceId ? { sourceObjectId: sourceId } : {}) })) {
      continue;
    }
    const total = amount + bonus;
    if (total < 1) continue;
    const dealt = dealDamage(context.room, id, total, context.step, sourceId ? { objectId: sourceId } : undefined);
    if (dealt > 0) done.push(id);
  }
  recordOutcome(context, done, done.length > 0);
  return RESOLVED;
});
