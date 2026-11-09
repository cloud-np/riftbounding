/**
 * Effect interpreter entry point — §6.2, 359.3.d, 401.1, 407.5.
 *
 * Dispatch goes through `EFFECT_OPS` (`effects/registry.ts`); ops live in `effects/ops/*.ts`
 * and register themselves at import time. Every execution runs on the resumable machine
 * (`effects/machine.ts`): a resolution that needs a player's decision stores its continuation in
 * an `effects.resume` prompt and reports `await`; FEPR keeps the item on the chain until the
 * answered continuation finishes (`timing/fepr/resolve.ts` `finishResolution`).
 *
 * Unregistered ops (and `status:"manual"` / missing scripts) still resolve through the §6.4
 * manual window exactly as in R1.
 */
import type { Ability, ChainItem, Effect, GameEvent, Room } from "@rift/protocol";
import type { RulesStepContext } from "../types";
import { lookupAbility } from "../cards/registry";
import "./ops";
import type { AbilityKindTag, EffectEnv } from "./env";
import { makeEnv } from "./env";
import { startMachine, type MachineHandle } from "./machine";
import { getEffectOp } from "./registry";

export interface EffectExecutionContext {
  room: Room;
  step: RulesStepContext;
  /** The chain item/ability currently resolving (targets are bound in `choices`). */
  itemId?: string;
  controller: string;
  choices?: Record<string, unknown>;
  /** R2-effects: the running machine (frame, env, push, ask). Absent for direct calls. */
  machine?: MachineHandle;
  /** R2-effects: source object for direct `executeEffect`/`executeAbility` calls. */
  sourceObjectId?: string;
  /** R2-effects: trigger event for direct calls. */
  event?: GameEvent;
}

export type EffectExecutionResult =
  | { status: "resolved"; events: GameEvent[] }
  | { status: "manual"; reason?: string }
  /** R2-effects: the op opened a resolution prompt; the machine stops until it is answered. */
  | { status: "await" };

export interface AbilityExecutionResult {
  /**
   * `await`: the resolution stopped on an `effects.resume` prompt (355.18); the chain item keeps
   * resolving — it stays on the chain until the continuation finishes (340 / 359).
   */
  status: "resolved" | "manual" | "await";
  reason?: string;
}

/** Shared "nothing else to report" result for leaf ops. */
export const RESOLVED: EffectExecutionResult = { status: "resolved", events: [] };

function envFromContext(context: EffectExecutionContext, kind?: AbilityKindTag): EffectEnv {
  const item = context.itemId ? context.room.rules?.chain.find((entry) => entry.id === context.itemId) : undefined;
  if (item) return envFromItem(item, context, kind);
  return makeEnv({
    controller: context.controller,
    ...(context.sourceObjectId ? { sourceObjectId: context.sourceObjectId } : {}),
    ...(context.itemId ? { itemId: context.itemId } : {}),
    ...(kind ? { kind } : {}),
    ...(context.event ? { event: context.event } : {}),
    choices: { ...(context.choices ?? {}) },
  });
}

/** Build the evaluation environment of a chain item (355 choices, 383.2.c.3.b event). */
export function envFromItem(item: ChainItem, context: EffectExecutionContext, kind?: AbilityKindTag): EffectEnv {
  const source = item.sourceObjectId ?? item.cardSnapshot?.id ?? context.sourceObjectId;
  const tag: AbilityKindTag =
    kind ??
    (item.origin === "add"
      ? "add"
      : item.kind === "activated"
        ? "activated"
        : item.kind === "triggered"
          ? "triggered"
          : "spell");
  return makeEnv({
    controller: item.controller,
    ...(source ? { sourceObjectId: source } : {}),
    ...(item.sourceName ?? item.cardName ? { sourceName: item.sourceName ?? item.cardName } : {}),
    itemId: item.id,
    kind: tag,
    choices: JSON.parse(JSON.stringify({ ...(item.choices ?? {}), ...(context.choices ?? {}) })) as Record<string, unknown>,
    ...(item.triggerEvent ? { event: item.triggerEvent } : {}),
    ...(item.targetSnapshot ? { snapshot: item.targetSnapshot } : {}),
  });
}

/** Execute one effect. With a running machine the op is dispatched directly. */
export function executeEffect(effect: Effect, context: EffectExecutionContext): EffectExecutionResult {
  if (context.machine) {
    const handler = getEffectOp(effect.op);
    if (!handler) return { status: "manual", reason: `effect_not_implemented:${effect.op}` };
    return handler(effect, context);
  }
  const result = startMachine(context.room, context.step, effect, envFromContext(context));
  if (result.status === "manual") return { status: "manual", reason: result.reason };
  if (result.status === "await") return { status: "await" };
  return { status: "resolved", events: [] };
}

function effectOfAbility(ability: Ability): Effect | null {
  if (ability.kind === "spell" || ability.kind === "triggered" || ability.kind === "activated") {
    return ability.effect;
  }
  return null;
}

/** Run an ability's effect (`await` while a resolution prompt is open). */
export function executeAbility(ability: Ability, context: EffectExecutionContext): AbilityExecutionResult {
  const effect = effectOfAbility(ability);
  if (!effect) return { status: "manual", reason: `ability_not_implemented:${ability.kind}` };
  const kind: AbilityKindTag =
    ability.kind === "spell" ? "spell" : ability.kind === "triggered" ? "triggered" : "activated";
  const result = startMachine(context.room, context.step, effect, envFromContext(context, kind));
  if (result.status === "manual") return { status: "manual", reason: result.reason };
  if (result.status === "await") return { status: "await" };
  return { status: "resolved" };
}

/**
 * Resolve the script for a chain item. Missing scripts and `status:"manual"` cards open the
 * manual window (§6.4). Items carrying an inline `effect` (delayed, reflexive and keyword
 * triggers, 387–393 / 808 / 816 / 817 / 823 / 831) run that effect.
 */
export function executeCardScript(
  name: string | undefined,
  abilityRef: string | undefined,
  context: EffectExecutionContext,
): AbilityExecutionResult {
  const item = context.itemId ? context.room.rules?.chain.find((entry) => entry.id === context.itemId) : undefined;
  if (item?.effect) {
    const result = startMachine(context.room, context.step, item.effect, envFromItem(item, context));
    if (result.status === "manual") return { status: "manual", reason: result.reason };
    if (result.status === "await") return { status: "await" };
    return { status: "resolved" };
  }
  // 818.1.c.2: "Equip is functionally short for '[Cost]: Attach this gear to a unit you
  // control.'" The play layer lists `equip:<n>` as a built-in activated ability and binds its
  // target (818.1.b.1); the resolution is the standard attach op (435, 818.2).
  if (item?.abilityRef?.startsWith("equip:") && item.sourceObjectId) {
    const attach: Effect = {
      op: "attach",
      gear: { targetRef: "self" },
      to: { targetRef: "target:0" },
    };
    const result = startMachine(context.room, context.step, attach, envFromItem(item, context));
    if (result.status === "manual") return { status: "manual", reason: result.reason };
    if (result.status === "await") return { status: "await" };
    return { status: "resolved" };
  }
  const lookup = lookupAbility(name, abilityRef);
  if (!lookup || lookup.script.status === "manual") {
    return { status: "manual", reason: "no_script" };
  }
  const effect = effectOfAbility(lookup.ability);
  if (!effect) return { status: "manual", reason: `ability_not_implemented:${lookup.ability.kind}` };
  const env = item ? envFromItem(item, context) : envFromContext(context);
  const result = startMachine(context.room, context.step, effect, env);
  if (result.status === "manual") return { status: "manual", reason: result.reason };
  if (result.status === "await") return { status: "await" };
  return { status: "resolved" };
}
