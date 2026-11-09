/**
 * Shared/core public surface — timing skeleton, state, intents entry, view and registries.
 *
 * Wave R2 agents add domain exports to their own barrel (`api/play`, `api/combat`,
 * `api/effects`); this file stays stable.
 */
export type {
  CardInfo,
  DrawOutcome,
  LocatedCard,
  RulesContext,
  RulesHost,
  RulesLogEntry,
} from "../host";

export type { RulesFailure, RulesStepContext } from "../types";
export { fail } from "../types";
export { effectiveKeywords, effectiveMight } from "../layers";
export type { KeywordSource } from "../layers";

export { applyRulesIntent, initializeStrictRules, INTENT_HANDLERS } from "../intents";
export type {
  RulesIntentResult,
  RulesIntentSuccess,
  IntentContext,
  IntentHandler,
  IntentResult,
} from "../intents";

export {
  chainExists,
  createRulesState,
  emptyRulesState,
  nextPlayerInTurnOrder,
  projectRules,
  showdownActive,
  turnOrderStartingAt,
  turnState,
} from "../state";
// 107.3: face-up Units present at a location (the host's unitsAt/hasUnitAt count facedown cards).
export { hasUnitPresentAt, playersPresentAt, unitsPresentAt } from "../state/presence";

export { advance } from "../timing/advance";
export type { AdvanceResult } from "../timing/advance";
export { MAX_CLEANUP_PASSES, runCleanup } from "../cleanup/cleanup";
export type {
  CleanupCustomInsertStep,
  CleanupInsert,
  CleanupInsertStep,
  CleanupInsertStepId,
  CleanupOptions,
} from "../cleanup/cleanup";
export {
  EXPIRATION_INSERTS,
  MAX_EXPIRATION_PASSES,
  getTaskHandler,
  processNextTask,
  queueTask,
  registerTaskHandler,
  runExpirationStep,
  TASK_HANDLERS,
  taskHandlerKinds,
} from "../timing/tasks";
export type { TaskHandler, TaskHandlerContext, TaskResult } from "../timing/tasks";
export { runCleanupOrQueue } from "../timing/fepr";

export {
  interceptAction,
  registerActionInterceptor,
  registerAdvanceHook,
  registerAfterFinalizeHook,
  registerCleanupHook,
  registerFinalizeHook,
  registeredHooks,
  runAdvanceHooks,
  runAfterFinalizeHooks,
  runCleanupHooks,
  runFinalizeHooks,
} from "../timing/hooks";
export type {
  ActionInterceptor,
  ActionProposal,
  AdvanceHookPoint,
  AfterFinalizeHook,
  CleanupHookPoint,
  FinalizeHook,
  RulesHook,
} from "../timing/hooks";

export { whoMayAct, legalIntents, explainIllegal } from "../view";
export { promptFor } from "../view";
export { gate, isCosmeticAction, isManualBoardAction } from "../gate";

export { pickRandomAction, pickPromptAnswer, mulberry32 } from "../bot/random";

// Auto-pass / auto-resolve (docs/rules/auto-pass.md).
export type { StrictInitOptions } from "../intents";
export {
  applyAutoPassUpdate,
  autoPassPrefs,
  DEFAULT_AUTO_PASS,
  defaultAutoPassPrefs,
  fullControl,
  MANUAL_AUTO_PASS,
  passUntilActive,
} from "../auto/prefs";
export { forcedPromptAnswer } from "../auto/forced";
export type { ForcedAnswer } from "../auto/forced";
export { holdsHiddenCards, hasLegalResponse, provablyNoResponse, responseCheck } from "../auto/respond";
export type { ResponseCheck } from "../auto/respond";
export { promptSignature, standingEligible } from "../auto/signature";
export { AUTO_ACTION_CAP, advanceWithAuto } from "../auto/run";
export type { AutoAction, AutoActionKind, AutoTrigger } from "../auto/run";

export { validateRulesIntent, WIRE_VALIDATORS } from "../legality/intent";
export {
  abilityTimingVerdict,
  baseActionVerdict,
  boardZones,
  cardTimingVerdict,
  keywordTimingVerdict,
} from "../legality/timing";

export {
  chosenPromptOption,
  getPromptHandler,
  PROMPT_REASONS,
  promptAnswerVerdict,
  promptHandlerReasons,
  promptReason,
  registerPromptHandler,
} from "../prompts";
export type {
  PromptHandler,
  PromptHandlerContext,
  PromptHandlerResult,
  PromptReason,
} from "../prompts";

export * as primitives from "../actions/primitives";
export {
  addResources,
  burnOut,
  channelRunes,
  conquer,
  dealDamage,
  drawCards,
  emptyPools,
  establishControl,
  exhaust,
  gainPoints,
  heal,
  hold,
  kill,
  movePrimitive,
  ready,
  readyAll,
  recall,
} from "../actions/primitives";
