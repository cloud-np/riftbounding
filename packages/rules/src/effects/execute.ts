/**
 * Effect interpreter entry point — §6.2.
 *
 * Dispatch goes through `EFFECT_OPS` (`effects/registry.ts`); ops live in `effects/ops/*.ts`
 * and register themselves at import time. R1 registers only `seq` (empty = no-op); every other
 * op resolves to `manual` exactly as before.
 */
import type { Ability, Effect, GameEvent, Room } from "@rift/protocol";
import type { RulesStepContext } from "../types";
import { lookupAbility } from "../cards/registry";
import "./ops";
import { EFFECT_OPS } from "./registry";

export interface EffectExecutionContext {
  room: Room;
  step: RulesStepContext;
  /** The chain item/ability currently resolving (targets are bound in `choices`). */
  itemId?: string;
  controller: string;
  choices?: Record<string, unknown>;
}

export type EffectExecutionResult =
  | { status: "resolved"; events: GameEvent[] }
  | { status: "manual"; reason?: string };

/** Execute one effect through the op registry; unregistered ops are manual. */
export function executeEffect(effect: Effect, context: EffectExecutionContext): EffectExecutionResult {
  const handler = EFFECT_OPS[effect.op];
  if (!handler) return { status: "manual", reason: `effect_not_implemented:${effect.op}` };
  return handler(effect, context);
}

export interface AbilityExecutionResult {
  status: "resolved" | "manual";
  reason?: string;
}

export function executeAbility(
  ability: Ability,
  context: EffectExecutionContext,
): AbilityExecutionResult {
  if (ability.kind === "triggered" || ability.kind === "activated") {
    const result = executeEffect(ability.effect, context);
    return result.status === "resolved"
      ? { status: "resolved" }
      : { status: "manual", reason: result.reason };
  }
  return { status: "manual", reason: `ability_not_implemented:${ability.kind}` };
}

/**
 * Resolve the script for a chain item. Missing scripts and `status:"manual"` cards open the
 * manual window (§6.4). R1 has an empty registry, so every real card resolves manually.
 */
export function executeCardScript(
  name: string | undefined,
  abilityRef: string | undefined,
  context: EffectExecutionContext,
): AbilityExecutionResult {
  const lookup = lookupAbility(name, abilityRef);
  if (!lookup || lookup.script.status === "manual") {
    return { status: "manual", reason: "no_script" };
  }
  const ability = lookup.ability;
  if (ability.kind === "spell") {
    const result = executeEffect(ability.effect, context);
    return result.status === "resolved" ? { status: "resolved" } : { status: "manual", reason: result.reason };
  }
  return executeAbility(ability, context);
}
