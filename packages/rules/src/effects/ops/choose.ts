/**
 * `choose` — a resolution-time pick (355.18; "Picks" are not targets, 355.7) bound to `key`.
 *
 * Later instructions refer to the picked objects with `{ targetRef: key }`. With fewer legal
 * objects than the minimum the player picks all of them (055: do as much as possible).
 */
import { RESOLVED } from "../execute";
import { matchingIds, resolvePlayers } from "../evaluate";
import { registerEffectOp } from "../registry";
import { optionFor, recordOutcome } from "../targets";
import { amountOf, ctxOf } from "./util";

registerEffectOp("choose", (effect, context) => {
  if (effect.op !== "choose") return { status: "manual", reason: "effect_not_implemented:choose" };
  const ctx = ctxOf(context);
  const machine = context.machine;
  if (!machine) return RESOLVED;
  const env = machine.env;
  if (Array.isArray(env.vars[effect.key])) return RESOLVED;
  const pool = matchingIds(ctx, { ...effect.selector, chosen: undefined, targetRef: undefined });
  const min = Math.max(0, amountOf(context, effect.min ?? 1) ?? 1);
  const max = Math.max(min, amountOf(context, effect.max ?? effect.min ?? 1) ?? 1);
  let picked: string[] | null = null;
  if (pool.length === 0) picked = [];
  else if (pool.length <= min) picked = pool;
  else if (machine.frame.answer !== undefined) {
    const answer = machine.frame.answer;
    picked = (Array.isArray(answer) ? answer : [answer]).filter(
      (id): id is string => typeof id === "string" && pool.includes(id),
    );
    machine.frame.answer = undefined;
  }
  if (picked === null) {
    const chooser = effect.chooser ? resolvePlayers(ctx, effect.chooser)[0] : env.controller;
    return machine.ask({
      kind: "choose-card",
      playerId: chooser ?? env.controller,
      options: pool.map((id) => optionFor(ctx, id)),
      min: Math.min(min, pool.length),
      max: Math.min(max, pool.length),
      rule: "355.18",
      promptKey: effect.label ?? effect.selector.label ?? "rules.prompt.choose",
      data: { answer: "objects" },
    });
  }
  env.vars[effect.key] = picked;
  recordOutcome(context, picked, picked.length > 0);
  return RESOLVED;
});
