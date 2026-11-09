/**
 * Test-only registry API (F1/G1).
 *
 * Production registrations are unique: `registerCardScript`, `registerCustomCondition`,
 * `registerCustomEffect`, `registerEffectOp`, `registerPromptHandler`, `registerTaskHandler` and
 * `registerAdditionalCosts` throw on a duplicate key. Tests that deliberately replace an entry
 * (a test-local script reusing a real card name, a stub handler) use the functions below; each
 * `override*` returns a restore function.
 *
 * Not re-exported from the package entry, and card files may not import it (the import-boundary
 * test in `test/registry/` enforces that card files only import `src/cards/sdk.ts`).
 */
import type { CardScript } from "@rift/protocol";
import { CARD_SCRIPTS, normalizeScript } from "./cards/registry";
import { CUSTOM_CONDITIONS, type CustomCondition } from "./effects/evaluate";
import { CUSTOM_EFFECTS, type CustomEffectHandler } from "./effects/ops/control";
import { EFFECT_OP_REGISTRY, type EffectOp, type OpHandler } from "./effects/registry";
import { ADDITIONAL_COSTS_BY_CARD, type AdditionalCostSpec } from "./play/additional-costs";
import { PROMPT_HANDLERS, type PromptHandler } from "./prompts/handlers";
import { TASK_HANDLER_REGISTRY, type TaskHandler } from "./timing/tasks/registry";
import type { TaskKind } from "@rift/protocol";

export { DuplicateRegistrationError } from "./registry-table";

/** Register or replace a card script (test-local scripts may reuse real card names). */
export function overrideCardScript(script: CardScript): () => void {
  return CARD_SCRIPTS.override(script.name, normalizeScript(script));
}

/** Register or replace several scripts; the restore function undoes all of them. */
export function overrideCardScripts(scripts: readonly CardScript[]): () => void {
  const restores = scripts.map((script) => overrideCardScript(script));
  return () => {
    for (const restore of restores.reverse()) restore();
  };
}

/** Register or replace a card script and return the stored (normalized, frozen) script. */
export function registerTestCardScript(script: CardScript): CardScript {
  overrideCardScript(script);
  return CARD_SCRIPTS.get(script.name) as CardScript;
}

export function unregisterCardScript(name: string): boolean {
  return CARD_SCRIPTS.unregister(name);
}

/** Remove every card script (suites that build their own tiny card pool). */
export function clearCardScripts(): void {
  CARD_SCRIPTS.clear();
}

export function overrideCustomCondition(id: string, fn: CustomCondition): () => void {
  return CUSTOM_CONDITIONS.override(id, fn);
}

export function overrideCustomEffect(id: string, handler: CustomEffectHandler): () => void {
  return CUSTOM_EFFECTS.override(id, handler);
}

export function overrideEffectOp(op: EffectOp, handler: OpHandler): () => void {
  return EFFECT_OP_REGISTRY.override(op, handler);
}

export function overridePromptHandler(reason: string, handler: PromptHandler): () => void {
  return PROMPT_HANDLERS.override(reason, handler);
}

export function overrideTaskHandler(kind: TaskKind, handler: TaskHandler): () => void {
  return TASK_HANDLER_REGISTRY.override(kind, handler);
}

export function overrideAdditionalCosts(cardName: string, specs: AdditionalCostSpec[]): () => void {
  return ADDITIONAL_COSTS_BY_CARD.override(cardName, specs);
}

/** Register or replace several scripts (the test-only form of `registerCardScripts`). */
export function registerTestCardScripts(scripts: readonly CardScript[]): void {
  for (const script of scripts) overrideCardScript(script);
}
