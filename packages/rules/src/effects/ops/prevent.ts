/**
 * `prevent` — rule 438 (a Delayed Replacement Effect, 438.7).
 *
 * 438.1.b.1: "Prevent the next X damage that would be dealt to a unit this turn" adds a shield
 * with Prevent Value X ("All" = unlimited, 438.1.b.1.b; amounts ≥ 9999 mean All). The shield is
 * consumed by the `deal_damage` interceptor (`replacements/interceptor.ts`, 438.2–438.4).
 */
import { pushEvent } from "../../types";
import { addPreventShield } from "../../layers/mods";
import { RESOLVED } from "../execute";
import { registerEffectOp } from "../registry";
import { recordOutcome, targets } from "../targets";
import { amountOf, ctxOf, hostOf, isOnBoard } from "./util";
import { isUnit } from "../objects";

export const PREVENT_ALL = 9999;

registerEffectOp("prevent", (effect, context) => {
  if (effect.op !== "prevent") return { status: "manual", reason: "effect_not_implemented:prevent" };
  const host = hostOf(context);
  const ctx = ctxOf(context);
  const found = effect.target ? targets(context, effect.target) : { ok: true as const, ids: ctx.env.sourceObjectId ? [ctx.env.sourceObjectId] : [] };
  if (!found.ok) return found.result;
  const amount = amountOf(context, effect.amount);
  const done: string[] = [];
  if (amount !== null && amount > 0) {
    const value = amount >= PREVENT_ALL ? "all" : amount;
    for (const id of found.ids) {
      if (!isOnBoard(context.room, host, id) || !isUnit(context.room, host, id)) continue;
      addPreventShield(context.room, host, id, value, "this-turn", ctx.env.controller, ctx.env.sourceObjectId);
      done.push(id);
      pushEvent(context.step.events, { type: "prevent", cardId: id, data: { value } });
    }
  }
  recordOutcome(context, done, done.length > 0);
  return RESOLVED;
});
