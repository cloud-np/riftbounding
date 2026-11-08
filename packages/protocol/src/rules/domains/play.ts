/**
 * Strict-rules wire types owned by wave R2-play.
 * Owned by wave R2-play. Add your union members / optional fields here only.
 *
 * Process of play (349–359), costs/payment, targets, activated abilities (376–381/399+) and
 * the Standard Move (449–455). `../core.ts` composes these hooks into the exported wire types.
 * Keep every added field optional so R1 consumers keep compiling.
 */

/** §5 — cost/payment/target/location rejections raised by the play layer (349–359, 449–455). */
export type PlayReasonCode =
  | "insufficient_resources"
  | "illegal_target"
  | "no_legal_targets"
  | "invalid_location"
  | "unit_exhausted"
  | "unit_not_found"
  | "card_not_found"
  | "not_in_hand";

/** 333 outstanding-task kinds owned by the play layer (payment/choice tasks). */
export type PlayTaskKind = never;

/** 411.2 prompt kinds owned by the play layer (payment/choose-power prompts). */
export type PlayPromptKind = never;

/** §6.2 Effect ops owned by the play/cost layer (composed into `Effect`). */
export type PlayEffectOp = never;

/** 418 object state added by the play layer (deployment/enter flags, …). */
export interface PlayObjectFields {}

/** `RulesHistory` counters owned by the play layer (played/paid-per-turn, …). */
export interface PlayHistoryFields {}

/** `PromptAnswer` fields used by play prompts (payment rune ids, power, …). */
export interface PlayPromptAnswerFields {}

/** `ChainItem` extras owned by the play layer (cost payment, 355 target binding, …). */
export interface PlayChainItemFields {}

/** `LegalIntents` extras owned by the play layer (affordability, hold flags, …). */
export interface PlayLegalIntentsFields {}

/** `WhoMayAct.window` members owned by the play layer (none yet; core has main/chain/showdown). */
export type PlayWhoWindow = never;

/** `WhoMayAct.kind` members owned by the play layer. */
export type PlayWhoKind = never;

/** `rules_play` payload extras (355 targets, X, modes, runeIds, …). */
export interface PlayPlayIntentFields {}

/** `rules_activate` payload extras (payment/target choices, …). */
export interface PlayActivateIntentFields {}
