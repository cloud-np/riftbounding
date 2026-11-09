/**
 * `deal_split` — rules 355.14 (Splitting), 418 (Deal), 715.3 (Bonus Damage on a split).
 *
 * - 355.14.a/b/d: every chosen unit is a Target, chosen when the item finalized
 *   (`requiredChoices` caps the count at the damage available then, 355.14.c / 715.3).
 * - 359.3.e / 355.11.b: illegal targets are dropped and a group requirement re-checked by
 *   `targets()` like any other targeted instruction.
 * - 355.14.h / h.1: with more targets than damage, the controller chooses which cease being
 *   Targets, keeping exactly one target per point of damage.
 * - 355.14.e–g: the division is chosen now; each target receives at least 1. A single target
 *   takes everything and N targets for N damage take 1 each without a prompt (411.2).
 * - 418.1.d / 418.6: the damage is dealt to the targets at the same time, from the named source
 *   (418.6.b.3) or the effect's source (418.6.a); 715.3: the Bonus Damage is part of the split
 *   total. Prevention/replacement runs through `dealDamage`'s interceptor.
 */
import type { Effect } from "@rift/protocol";
import type { EffectExecutionContext, EffectExecutionResult } from "../execute";
import { dealDamage } from "../../actions/damage";
import { restrictionFor } from "../../layers/restrictions";
import { RESOLVED } from "../execute";
import { idsOf } from "../env";
import { resolveSelector } from "../evaluate";
import { isUnit } from "../objects";
import { registerEffectOp } from "../registry";
import { splitTotal } from "../choices";
import type { SplitShare } from "../split";
import { optionFor, recordOutcome, targets } from "../targets";
import { ctxOf, hostOf, isOnBoard } from "./util";

type SplitEffect = Extract<Effect, { op: "deal_split" }>;

registerEffectOp("deal_split", (effect, context) => {
  if (effect.op !== "deal_split") return { status: "manual", reason: "effect_not_implemented:deal_split" };
  return dealSplit(effect, context);
});

function dealSplit(effect: SplitEffect, context: EffectExecutionContext): EffectExecutionResult {
  const ctx = ctxOf(context);
  const host = hostOf(context);
  const machine = context.machine;
  const found = targets(context, effect.target);
  if (!found.ok) return found.result;
  const total = splitTotal(ctx, effect);
  const key = effect.target.targetRef ?? "target:0";
  let ids = found.ids;
  if (total === null || total < 1 || ids.length === 0) {
    recordOutcome(context, [], false);
    return RESOLVED;
  }
  const stage = machine?.frame.data?.stage;

  // 355.14.h / h.1: drop targets beyond the damage (exactly `total` remain).
  if (ids.length > total) {
    if (machine && stage === "drop" && machine.frame.answer !== undefined) {
      const kept = idsOf(machine.frame.answer).filter((id) => ids.includes(id));
      machine.frame.answer = undefined;
      machine.frame.data = {};
      const dropped = ids.filter((id) => !kept.includes(id));
      ctx.env.vars[`$legal:${key}`] = kept;
      ctx.env.vars[`$illegal:${key}`] = [...idsOf(ctx.env.vars[`$illegal:${key}`]), ...dropped];
      ids = kept;
    } else if (machine) {
      machine.frame.data = { stage: "drop" };
      return machine.ask({
        kind: "choose-target",
        playerId: ctx.env.controller,
        options: ids.map((id) => optionFor(ctx, id)),
        min: total,
        max: total,
        rule: "355.14.h",
        promptKey: "rules.prompt.splitKeepTargets",
        data: { answer: "objects", exact: total },
      });
    } else {
      ids = ids.slice(0, total);
    }
  }

  // 355.14.e–g: the division.
  let shares: SplitShare[];
  if (ids.length === 1) shares = [{ targetId: ids[0]!, amount: total }];
  else if (ids.length === total) shares = ids.map((targetId) => ({ targetId, amount: 1 }));
  else if (machine && machine.frame.data?.stage === "divide" && machine.frame.answer !== undefined) {
    shares = (machine.frame.answer as SplitShare[]).filter((share) => ids.includes(share.targetId));
    machine.frame.answer = undefined;
    machine.frame.data = {};
  } else if (machine) {
    machine.frame.data = { stage: "divide" };
    return machine.ask({
      kind: "damage-assignment",
      playerId: ctx.env.controller,
      options: ids.map((id) => optionFor(ctx, id)),
      min: 0,
      max: ids.length,
      rule: "355.14.e",
      promptKey: "rules.prompt.splitDamage",
      data: { answer: "split", total, targets: [...ids], minEach: 1 },
    });
  } else {
    shares = ids.map((targetId, index) => ({ targetId, amount: index === 0 ? total - ids.length + 1 : 1 }));
  }

  // 418.1.d: dealt at the same time; 418.6: source.
  const sources = effect.source ? resolveSelector(ctx, effect.source) : [];
  const sourceId = sources[0] ?? ctx.env.sourceObjectId;
  const done: string[] = [];
  for (const share of shares) {
    const id = share.targetId;
    if (share.amount < 1 || !isOnBoard(context.room, host, id) || !isUnit(context.room, host, id)) continue;
    if (restrictionFor(context.room, host, { kind: "be-dealt-damage", objectId: id, ...(sourceId ? { sourceObjectId: sourceId } : {}) })) {
      continue;
    }
    const dealt = dealDamage(context.room, id, share.amount, context.step, {
      ...(sourceId ? { objectId: sourceId } : {}),
      // 429.5.c.1: the controller of the deal action is responsible for a resulting kill.
      playerId: ctx.env.controller,
    });
    if (dealt > 0) done.push(id);
  }
  recordOutcome(context, done, done.length > 0);
  return RESOLVED;
}
