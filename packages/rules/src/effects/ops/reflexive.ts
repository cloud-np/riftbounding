/**
 * `reflexive` — Reflexive Triggers 387–389 ("Do this:", "Do this N times:").
 *
 * 389.1: a new ability is created and added to the chain as a Pending Item; 389.2: several
 * items are created in order and none goes beyond the first step (402.2: the current
 * resolution continues first). 388.4: a leading "you may" is decided when the reflexive trigger
 * finalizes (`optional`). Choices of the reflexive ability are made on its finalization
 * (355.5.b); the parent's resolved targets and variables are copied into its `choices` so
 * linked references ("there", "it") keep working (359.3.e.14).
 */
import type { ChainItem, ChoiceRecord } from "@rift/protocol";
import { appendChainItem } from "../../timing/fepr/chain";
import type { EffectEnv } from "../env";
import { RESOLVED } from "../execute";
import { registerEffectOp } from "../registry";
import { recordOutcome } from "../targets";
import { amountOf, hostOf } from "./util";

/** Parent bindings visible to a created ability (targets after legality, variables, LKI). */
export function inheritedChoices(env: EffectEnv): ChoiceRecord {
  const out: Record<string, unknown> = { ...env.choices };
  for (const [key, value] of Object.entries(env.vars)) {
    if (key.startsWith("$legal:")) out[key.slice("$legal:".length)] = value;
    else if (key === "$lki") out.$lki = value;
    else if (!key.startsWith("$")) out[key] = value;
  }
  return JSON.parse(JSON.stringify(out)) as ChoiceRecord;
}

registerEffectOp("reflexive", (effect, context) => {
  if (effect.op !== "reflexive") return { status: "manual", reason: "effect_not_implemented:reflexive" };
  const machine = context.machine;
  if (!machine) return RESOLVED;
  const host = hostOf(context);
  const env = machine.env;
  const times = Math.max(1, Math.min(20, amountOf(context, effect.times ?? 1) ?? 1));
  const created: string[] = [];
  for (let index = 0; index < times; index += 1) {
    const item: ChainItem = {
      id: host.nextId("chain"),
      kind: "triggered",
      status: "pending",
      controller: env.controller,
      ...(env.sourceObjectId ? { sourceObjectId: env.sourceObjectId } : {}),
      ...(env.sourceName ? { cardName: env.sourceName, sourceName: env.sourceName } : {}),
      abilityRef: "reflexive",
      choices: inheritedChoices(env),
      origin: "trigger",
      effect: effect.effect,
      ...(effect.optional ? { optional: true } : {}),
      ...(env.event ? { triggerEvent: env.event } : {}),
      addedAt: host.now(),
    };
    appendChainItem(context.room, item, context.step);
    created.push(item.id);
  }
  recordOutcome(context, [], created.length > 0);
  return RESOLVED;
});
