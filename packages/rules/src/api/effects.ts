/**
 * Effects-domain public surface — card scripts, the effect-op registry and the interpreter.
 *
 * `import "../cards"` is the production registration path: importing the package (or the
 * engine, which imports `@rift/rules`) registers every card script, not only the tests.
 */
import "../cards";

export {
  registerCardScript,
  registerCardScripts,
  getCardScript,
  hasCardScript,
  cardScriptNames,
  clearCardScripts,
  lookupAbility,
  listActivatedAbilities,
} from "../cards/registry";
export type { ActivatedAbilityEntry, CardScriptLookup } from "../cards/registry";
export { executeEffect, executeAbility, executeCardScript } from "../effects/execute";
export type { EffectExecutionContext, EffectExecutionResult } from "../effects/execute";
export {
  EFFECT_OPS,
  getEffectOp,
  registerEffectOp,
  registeredEffectOps,
} from "../effects/registry";
export type { EffectOp, OpHandler } from "../effects/registry";
export { requiredChoices, validateChoices } from "../effects/choices";
export type { ChoiceSpec, ChoiceContext } from "../effects/choices";
export { flushPendingTriggers } from "../triggers";
export { costAdjustments } from "../layers/costs";
export type { CostAdjustment } from "../layers/costs";
export { restrictionFor } from "../layers/restrictions";
export type { RestrictionKind, RestrictionQuery } from "../layers/restrictions";
export { previewDamage } from "../replacements/preview";
