/**
 * `add_counter` / `spend_counter` — Counters 741–749.
 *
 * 742.1: counters are never targeted (chosen as the instruction executes). 745.1: spending
 * removes that many counters of the type (any type when unspecified, 745.1.a); 745.2: only from
 * objects the spender controls. 748: counters are lost when the object leaves the board (its
 * rules object is dropped).
 */
import { pushEvent } from "../../types";
import { RESOLVED } from "../execute";
import { registerEffectOp } from "../registry";
import { recordOutcome, targets } from "../targets";
import { amountOf, hostOf, isOnBoard } from "./util";
import { controllerOf } from "../objects";

registerEffectOp("add_counter", (effect, context) => {
  if (effect.op !== "add_counter") return { status: "manual", reason: "effect_not_implemented:add_counter" };
  const found = targets(context, effect.target);
  if (!found.ok) return found.result;
  const host = hostOf(context);
  const amount = Math.max(0, amountOf(context, effect.amount ?? 1) ?? 1);
  const done: string[] = [];
  for (const id of found.ids) {
    if (amount <= 0 || !isOnBoard(context.room, host, id)) continue;
    const value = host.adjustCounter(context.room, id, effect.counter, amount);
    done.push(id);
    pushEvent(context.step.events, { type: "counter_added", cardId: id, amount, data: { counter: effect.counter, value } });
  }
  recordOutcome(context, done, done.length > 0);
  return RESOLVED;
});

registerEffectOp("spend_counter", (effect, context) => {
  if (effect.op !== "spend_counter") return { status: "manual", reason: "effect_not_implemented:spend_counter" };
  const found = targets(context, effect.target);
  if (!found.ok) return found.result;
  const host = hostOf(context);
  const amount = Math.max(0, amountOf(context, effect.amount ?? 1) ?? 1);
  const done: string[] = [];
  for (const id of found.ids) {
    if (controllerOf(context.room, host, id) !== context.controller) continue;
    const counters = context.room.rules?.objects[id]?.counters ?? {};
    const kind = effect.counter ?? Object.keys(counters).find((key) => (counters[key] ?? 0) > 0);
    if (!kind || (counters[kind] ?? 0) < amount) continue;
    const value = host.adjustCounter(context.room, id, kind, -amount);
    done.push(id);
    pushEvent(context.step.events, { type: "counter_spent", cardId: id, amount, data: { counter: kind, value } });
  }
  recordOutcome(context, done, done.length > 0);
  return RESOLVED;
});
