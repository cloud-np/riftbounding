/**
 * Strict-rules wire types owned by wave R2-int.
 * Owned by wave R2-int. Add your union members / optional fields here only.
 *
 * Sync redaction, realtime and apps/play. R2-int mostly *consumes* the unions composed in
 * `../core.ts` (and the other domain files), but it may need view-only additions for the
 * strict UI. `../core.ts` composes these hooks into the exported wire types.
 * Keep every added field optional so R1 consumers keep compiling.
 */

/** §5 — view/sync-facing rejection codes (add here only if the UI needs its own). */
export type IntReasonCode =
  /** A board gesture matches several legal strict actions; the client must choose one. */
  | "ambiguous_gesture";

/** 333 outstanding-task kinds owned by the integration layer. */
export type IntTaskKind = never;

/** 411.2 prompt kinds owned by the integration layer. */
export type IntPromptKind = never;

/** §6.2 Effect ops owned by the integration layer. */
export type IntEffectOp = never;

/** 418 object state added by the integration layer (view-only projections). */
export interface IntObjectFields {}

/** `RulesHistory` counters owned by the integration layer. */
export interface IntHistoryFields {}

/** `PromptAnswer` fields owned by the integration layer. */
export interface IntPromptAnswerFields {}

/** `ChainItem` extras owned by the integration layer. */
export interface IntChainItemFields {}

/** `LegalIntents` extras owned by the integration layer. */
export interface IntLegalIntentsFields {}

/** `WhoMayAct.window` members owned by the integration layer. */
export type IntWhoWindow = never;

/** `WhoMayAct.kind` members owned by the integration layer. */
export type IntWhoKind = never;
