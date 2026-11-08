/**
 * Effects-domain public surface — card scripts, the effect-op registry, the interpreter,
 * triggers, replacements and layers (R2-effects).
 *
 * `import "../cards"` is the production registration path: importing the package (or the
 * engine, which imports `@rift/rules`) registers every card script, not only the tests. The
 * trigger hooks and the replacement interceptor register here as well.
 */
import "../cards";
import "../effects/ops";
import "../triggers/hooks";
import "../replacements/interceptor";

export {
  registerCardScript,
  registerCardScripts,
  getCardScript,
  hasCardScript,
  cardScriptNames,
  clearCardScripts,
  lookupAbility,
  listActivatedAbilities,
  parseActivatedAbilityTexts,
  normalizeChoiceKeys,
} from "../cards/registry";
export type { ActivatedAbilityEntry, CardScriptLookup } from "../cards/registry";
export { executeEffect, executeAbility, executeCardScript, envFromItem } from "../effects/execute";
export type { EffectExecutionContext, EffectExecutionResult, AbilityExecutionResult } from "../effects/execute";
export {
  EFFECT_OPS,
  getEffectOp,
  registerEffectOp,
  registeredEffectOps,
} from "../effects/registry";
export type { EffectOp, OpHandler } from "../effects/registry";
export { registerCustomEffect, customEffectIds } from "../effects/ops";
export type { CustomEffectHandler } from "../effects/ops";
export { runMachine, startMachine } from "../effects/machine";
export type { Continuation, Frame, MachineHandle, MachineResult, AskSpec } from "../effects/machine";
export type { EffectEnv, EvalContext, LastKnown } from "../effects/env";
export { makeEnv } from "../effects/env";
export {
  evaluateAmount,
  evaluateCondition,
  matchesSelector,
  matchingIds,
  registerCustomCondition,
  resolvePlayers,
  resolveSelector,
  resolveZoneNames,
  xpOf,
} from "../effects/evaluate";
export type { CustomCondition } from "../effects/evaluate";
export { requiredChoices, validateChoices } from "../effects/choices";
export type { ChoiceSpec, ChoiceContext } from "../effects/choices";
export { flushPendingTriggers, collectTriggers, collectPhaseTriggers, triggerSources } from "../triggers";
export { KEYWORD_TRIGGERS } from "../triggers/keywords";
export { costAdjustments, consumeOnceCostEffects } from "../layers/costs";
export type { CostAdjustment } from "../layers/costs";
export { restrictionFor } from "../layers/restrictions";
export type { RestrictionKind, RestrictionQuery } from "../layers/restrictions";
export { effectiveKeywordValues, rawMight, splitKeyword } from "../layers";
export { activeModifiers } from "../layers/passives";
export type { ActiveModifier } from "../layers/passives";
export { bonusDamage } from "../layers/bonus";
export { victoryScoreAdjustment } from "../layers/victory";
export { enterReadyApplies } from "../layers/entry";
export { addContinuousEffect, addKeywordGrant, addMight, addPreventShield } from "../layers/mods";
export { previewDamage } from "../replacements/preview";
export { preventValue, replacementSources } from "../replacements/interceptor";
export { EFFECTS_PROMPT_REASONS } from "../prompts/effects/reasons";
