/**
 * Strict-rules wire types owned by wave R2-effects.
 * Owned by wave R2-effects. Add your union members / optional fields here only.
 *
 * Effect DSL interpreter (§6.2), game actions 412–448, triggers (382+, 303.2.a), replacements
 * (367–375) and layers (475–479). `../core.ts` / `../effects.ts` compose these hooks into the
 * exported wire types. Keep every added field optional so R1 consumers keep compiling.
 */

/** §5 — effect/choice/trigger rejections (§6.2, §6.4, 411.2). */
export type EffectsReasonCode =
  "invalid_choice" | "manual_window_pending" | "no_manual_window" | "not_implemented";

/** 333 outstanding-task kinds owned by the effects layer (trigger/replacement/layer tasks). */
export type EffectsTaskKind = never;

/** 411.2 prompt kinds owned by the effects layer (order, multi-card selection, …). */
export type EffectsPromptKind = never;

/** §6.2 Effect ops owned by the effects layer (most new `Effect` members land here). */
export type EffectsEffectOp = never;

/** 418 object state added by the effects layer (granted keywords, prevention shields, …). */
export interface EffectsObjectFields {}

/** `RulesHistory` counters owned by the effects layer (triggered/played-from-zone, …). */
export interface EffectsHistoryFields {}

/** `PromptAnswer` fields used by effect prompts. */
export interface EffectsPromptAnswerFields {
  /** Ordering prompts (e.g. order cards put on top of the deck). */
  orderedIds?: string[];
  /** `choose_mode` answers. */
  modes?: string[];
}

/** `ChainItem` extras owned by the effects layer (trigger/replacement provenance, …). */
export interface EffectsChainItemFields {}

/** `LegalIntents` extras owned by the effects layer (prompt details, …). */
export interface EffectsLegalIntentsFields {}

/** `WhoMayAct.window` members owned by the effects layer. */
export type EffectsWhoWindow = never;

/** `WhoMayAct.kind` members owned by the effects layer. */
export type EffectsWhoKind = never;
