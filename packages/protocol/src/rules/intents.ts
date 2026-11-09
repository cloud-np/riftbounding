/**
 * @rift/protocol — strict-rules intents (§3).
 *
 * Every `rules_*` wire action is legal only in strict mode + in_game. The play/activate payloads
 * are extensible from `./domains/play.ts`; `RULES_ACTION_PREFIX` stays a runtime value.
 */

import type { ChoiceRecord, PaidCost, PromptAnswer, RulesMode } from "./core";
import type { ZoneSelector } from "./effects";
import type { PlayActivateIntentFields, PlayPlayIntentFields } from "./domains/play";

/** Core `rules_play` payload (349–359). R2-play adds fields in `./domains/play.ts`. */
export interface CoreRulesPlayIntent {
  type: "rules_play";
  cardId: string;
  choices?: ChoiceRecord;
  payment?: PaidCost;
  hold?: boolean;
  /** 355.2 / 355.4: chosen location for units (base or a controlled battlefield). */
  location?: ZoneSelector;
}

export type RulesPlayIntent = CoreRulesPlayIntent & PlayPlayIntentFields;

/** Core `rules_activate` payload (376–381, 399+). R2-play adds fields in `./domains/play.ts`. */
export interface CoreRulesActivateIntent {
  type: "rules_activate";
  objectId: string;
  ability: string;
  choices?: ChoiceRecord;
  payment?: PaidCost;
  hold?: boolean;
}

export type RulesActivateIntent = CoreRulesActivateIntent & PlayActivateIntentFields;

export interface RulesMoveIntent {
  type: "rules_move";
  unitIds: string[];
  to: ZoneSelector;
}

export interface RulesPassIntent {
  type: "rules_pass";
}

export interface RulesEndTurnIntent {
  type: "rules_end_turn";
}

export interface RulesChooseIntent {
  type: "rules_choose";
  promptId: string;
  answer: PromptAnswer;
}

export interface RulesManualDoneIntent {
  type: "rules_manual_done";
}

/**
 * 649–652 (R2-int): concede the game. A player may concede at any time (650); they lose and are
 * removed (651 / 652; in 2v2 with their team, 491.6.a). No payload.
 */
export interface RulesConcedeIntent {
  type: "rules_concede";
}

export type RulesIntent =
  | RulesPlayIntent
  | RulesActivateIntent
  | RulesMoveIntent
  | RulesPassIntent
  | RulesEndTurnIntent
  | RulesChooseIntent
  | RulesManualDoneIntent
  | RulesConcedeIntent;

/** Lobby toggle (host only, lobby phase). */
export interface SetLobbyRulesModeAction {
  type: "set_lobby_rules_mode";
  mode: RulesMode;
}

/** Runtime guard: every `rules_*` wire action starts with this prefix. */
export const RULES_ACTION_PREFIX = "rules_";

export type RulesWireAction =
  | RulesPlayIntent
  | RulesActivateIntent
  | RulesMoveIntent
  | RulesPassIntent
  | RulesEndTurnIntent
  | RulesChooseIntent
  | RulesManualDoneIntent
  | RulesConcedeIntent;
