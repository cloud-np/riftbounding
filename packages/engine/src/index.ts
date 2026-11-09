/**
 * @rift/engine — authoritative Riftbound rules engine (pure TypeScript, no IO).
 *
 * Port of the original client transition function (`35qz5rkx7yexy.js` `cU`/`cY` +
 * helper modules 375934/487939/70094/51407/408727/888811/371460/…) with identical
 * semantics. Time and randomness come exclusively from `ActionContext`.
 */
import type { Room } from "@rift/protocol";
export type GameState = Room;

export { createInitialGameState, setupCards, emptyPlayerBoard } from "./state/init";
export { firstSetupPhase, phaseAfterSideboarding } from "./state/phases";
export type { GameSetupConfig, GameSetupPlayer, DeckData } from "./types";
export type { ActionContext, EngineResult, EngineSuccess, EngineFailure, LogDraft } from "./types";
export type { EngineTimeline, EngineTimelineEntry } from "@rift/protocol";
export { applyGameAction, getLegalActions } from "./engine";
export { ACTION_HANDLERS, GAMEPLAY_ACTION_TYPES, REWIND_ACTION_TYPES } from "./actions";
export { OPTIMISTIC_ACTIONS } from "@rift/protocol";
export { parseDecklist, emptyDeckSections } from "./rules/decklist";
export {
  GAME_VARIANTS,
  VARIANT_RULES,
  entityGroups,
  orderedTurnOrder,
  scoreVictoryPlayerIds,
  variantForPlayerCount,
  variantForRoom,
} from "./state/variant";
export { victoryScoreForRoom, nearVictoryScore } from "./rules/victory";
export {
  buildAutoPayPaymentBatch,
  planPayment,
  planToOperations,
  normalizeCost,
} from "./rules/autopay";
export { validateBatch } from "./rules/batch";
export { ENGINE_ERRORS, ERROR_CODES } from "./errors";
export { logDraft } from "./log/entries";
export { renderSentence, actionKindFor } from "./log/templates";
export type { GameLogEntry } from "./log/entries";
export {
  createInitialTimeline,
  FORWARD_WINDOW_MS,
  REWIND_PROTOCOL_VERSION,
} from "./rules/rewind";
export {
  strictExplainIllegal,
  strictLegalIntents,
  strictTurnState,
  strictWhoMayAct,
} from "./strict/view";
export { pickStrictBotAction } from "./strict/bot";
export { translateGesture } from "./strict/gestures";
