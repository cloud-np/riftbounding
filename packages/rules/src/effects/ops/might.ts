/**
 * Might ops — `temporary_might` / `give_might` (479.4 Arithmetic layer, "give +X [M] this turn").
 *
 * 479.4.b: a limitation on a non-passive arithmetic effect is applied once and remembered
 * ("snapshotting", EX[255]: "-4 to a min of 1" on a 2 Might unit generates -1). 479.4.c: an
 * increase by a negative amount increases by 0.
 */
import type { EffectDuration, Selector } from "@rift/protocol";
import { pushEvent } from "../../types";
import { addMight } from "../../layers/mods";
import { rawMight } from "../../layers";
import type { EffectExecutionContext, EffectExecutionResult } from "../execute";
import { RESOLVED } from "../execute";
import { registerEffectOp } from "../registry";
import { recordOutcome, targets } from "../targets";
import { amountOf, ctxOf, hostOf, isOnBoard } from "./util";
import { isUnit } from "../objects";

export function giveMight(
  context: EffectExecutionContext,
  target: Selector,
  amountInput: Parameters<typeof amountOf>[1],
  duration: EffectDuration,
  min?: number,
): EffectExecutionResult {
  const found = targets(context, target);
  if (!found.ok) return found.result;
  const amount = amountOf(context, amountInput);
  const host = hostOf(context);
  const ctx = ctxOf(context);
  const done: string[] = [];
  if (amount === null || amount === 0) {
    recordOutcome(context, [], false);
    return RESOLVED;
  }
  for (const id of found.ids) {
    if (!isOnBoard(context.room, host, id) || !isUnit(context.room, host, id)) continue;
    let applied = amount;
    if (min !== undefined && amount < 0) {
      // 479.4.b snapshot: never reduce below `min`.
      const current = rawMight(context.room, id, host);
      applied = Math.min(0, Math.max(amount, min - current));
    }
    if (applied === 0) continue;
    addMight(context.room, host, id, applied, duration, ctx.env.controller, ctx.env.sourceObjectId);
    done.push(id);
    pushEvent(context.step.events, {
      type: "might",
      cardId: id,
      amount: applied,
      playerId: ctx.env.controller,
      data: { duration },
    });
  }
  recordOutcome(context, done, done.length > 0);
  return RESOLVED;
}

registerEffectOp("temporary_might", (effect, context) => {
  if (effect.op !== "temporary_might") return { status: "manual", reason: "effect_not_implemented:temporary_might" };
  return giveMight(context, effect.target, effect.amount, effect.duration ?? "this-turn");
});

registerEffectOp("give_might", (effect, context) => {
  if (effect.op !== "give_might") return { status: "manual", reason: "effect_not_implemented:give_might" };
  return giveMight(context, effect.target, effect.amount, effect.duration ?? "this-turn", effect.min);
});
