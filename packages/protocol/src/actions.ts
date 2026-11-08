/**
 * Riftbound simulator — action union (client→server contract).
 *
 * Sources:
 *  - .recon/api/game-action-types.txt            (138 extracted strings; NOT all are actions)
 *  - .recon/pretty/playapp/35qz5rkx7yexy.js      (client optimistic engine `cU` L22719; optimistic set `cV` L24296;
 *                                                 rewind classifier `c9` L24822; setup gating L36600-36760;
 *                                                 lobby callbacks L34560-34880; HTTP room API L21750-22030)
 *  - .recon/pretty/playapp/1w8d13szpogkp.js      (action_intent/room_shell_action transport L3871/L3967)
 *  - .recon/pretty/playapp/0xawjzm3yjpr1.js      (payload fields at call sites)
 *
 * Transport: gameplay actions → websocket `action_intent` (35qz5rkx7yexy.js:3967, 1w8d13szpogkp.js:3967).
 *            lobby/setup/result actions → websocket `room_shell_action` (1w8d13szpogkp.js:3871).
 *            Client-local UI actions → interaction store only (0xawjzm3yjpr1.js:47584 hB/hL); 16 such types.
 *
 * Classification of the 138 strings:
 *   ~99 wire action types (below), 16 client-local UI actions, 23 non-action values
 *   (connection states idle/loading/unavailable/missing/found/signed_out/reconnecting/auth_pending/log,
 *    zone names base/hand/champion/trash, variants free_for_all_3/free_for_all_4/teams_2v2,
 *    UI labels look_top_card/look_top_rune/look_at_bottom/shuffle_unrecycled/on_top_recycle_rest/
 *    to_hand_recycle_rest, i18n key "chat").
 */

import type {
  BattlefieldZone,
  BoardSettings,
  BoardZone,
  CardInstance,
  DecklistEntry,
  GameVariant,
  MatchFormat,
  PlayMode,
  Zone,
} from "./game-state";
import type { RulesWireAction, SetLobbyRulesModeAction } from "./rules-state";

/** Every action gets a type tag; extra client-side fields are allowed. */
export interface ActionBase {
  type: string;
}

/** Optional fields the transport adds (clientActionId / actorPlayerId live in the envelope). */
export interface ObservedTurnState {
  observed: { turnNumber: number; activePlayerId: string; activeStep: "beginning" | "main" };
}

/* ==================================================================== 1. LOBBY / ROOM (room_shell_action) */

export interface AddSoloOpponentAction extends ActionBase {
  type: "add_solo_opponent";
  /** exactly one of: raw decklist text, or sealed registration (see SealedRegistration) */
  decklist?: string;
  sealedRegistration?: SealedRegistration;
}

export interface SetLobbyReadyAction extends ActionBase { type: "set_lobby_ready"; ready: boolean; }
export interface SwitchLobbySeatAction extends ActionBase { type: "switch_lobby_seat"; targetSeat: number; }
export interface RandomizeLobbyTeamsAction extends ActionBase { type: "randomize_lobby_teams"; }
export interface SetLobbyPlayModeAction extends ActionBase { type: "set_lobby_play_mode"; playMode: PlayMode; }
export interface SetLobbyDeckRulesAction extends ActionBase { type: "set_lobby_deck_rules"; mode: "standard" | "unrestricted"; }
export interface SetLobbyGameVariantAction extends ActionBase { type: "set_lobby_game_variant"; gameVariant: GameVariant; }
export interface SetLobbyMatchFormatAction extends ActionBase { type: "set_lobby_match_format"; matchFormat: MatchFormat; }
export interface StartLobbyMatchAction extends ActionBase { type: "start_lobby_match"; }
export interface SubmitDeckAction extends ActionBase {
  type: "submit_deck";
  decklist: string;                      // raw decklist text (server parses/validates)
}
export interface SubmitSealedDraftAction extends ActionBase {
  type: "submit_sealed_draft";
  draftId: string;
  sealedRegistration: SealedRegistration;
}
export interface SealedRegistration {
  formatId: string;
  sealedDraftId: string;
  seed: number;
  builderSelection: {
    legendInstanceId?: string;
    championInstanceId?: string;
    mainDeckInstanceIds: string[];
    battlefieldInstanceIds: string[];
    runeCounts?: Partial<Record<string, number>>;
  };
}

/* ==================================================================== 2. SETUP (room_shell_action; partykit class) */

export interface SubmitSideboardAction extends ActionBase {
  type: "submit_sideboard";
  /** sealed only */
  legend?: DecklistEntry[];
  champion: DecklistEntry[];
  mainDeck: DecklistEntry[];
  sideboard: DecklistEntry[];
  /** set when sideboarding is skipped */
  skipped?: boolean;
}
export interface RequestSideboardSkipAction extends ActionBase { type: "request_sideboard_skip"; }
export interface RespondSideboardSkipAction extends ActionBase {
  type: "respond_sideboard_skip";
  response: "accept" | "decline" | "cancel"; // "cancel" only by the requester (L37100+)
}
export interface SelectBattlefieldAction extends ActionBase {
  type: "select_battlefield";
  battlefield?: string;                  // battlefield name; omitted when random
  random?: boolean;
}
export interface AutoStartTestSetupAction extends ActionBase { type: "auto_start_test_setup"; }
export interface ConfirmSoloSetupAction extends ActionBase { type: "confirm_solo_setup"; }
export interface RollInitiativeAction extends ActionBase { type: "roll_initiative"; }
export interface ChooseFirstPlayerAction extends ActionBase { type: "choose_first_player"; firstPlayerId: string; }
export interface ChooseSinglePlayerTurnOrderAction extends ActionBase {
  type: "choose_single_player_turn_order";
  turnOrder: "play_first" | "play_second";
}
export interface SubmitMulliganAction extends ActionBase {
  type: "submit_mulligan";
  cardIds: string[];                     // up to 2 hand card ids to recycle
  /** Client sends its local board settings with the mulligan (35qz5rkx7yexy.js:36779). */
  boardSettings?: BoardSettings;
}

/* ==================================================================== 3. GAME RESULT (room_shell_action) */

export interface RequestGameResultConfirmationAction extends ActionBase { type: "request_game_result_confirmation"; }
export interface CancelGameResultConfirmationAction extends ActionBase { type: "cancel_game_result_confirmation"; }
export interface ReportGameResultAction extends ActionBase { type: "report_game_result"; winnerPlayerId: string; }  // bo3 only
export interface RequestBo3RematchAction extends ActionBase { type: "request_bo3_rematch"; }

/* ==================================================================== 4. TURN STRUCTURE (action_intent) */

export interface EndTurnAction extends ObservedTurnState { type: "end_turn"; }            // server-only application (not optimistic)
export interface EndBeginningPhaseAction extends ObservedTurnState { type: "end_beginning_phase"; }
export interface SetExtraTurnAction extends ActionBase {
  type: "set_extra_turn";
  entryId: string;                       // top chain entry id (Time Warp, OGN-122)
  enabled: boolean;
}
/** per-player board settings (also reflected in room.boardSettingsByPlayerId) */
export interface SetShowLegendXpCounterAction extends ActionBase { type: "set_show_legend_xp_counter"; visible: boolean; }
export interface SetStopAtBeginningPhaseAction extends ActionBase { type: "set_stop_at_beginning_phase"; enabled: boolean; }
export interface SetSkipDrawPhaseAction extends ActionBase { type: "set_skip_draw_phase"; enabled: boolean; }
export interface SetAutoScoreFromHoldAction extends ActionBase { type: "set_auto_score_from_hold"; enabled: boolean; }

/* ==================================================================== 5. CARD MOVEMENT (action_intent) */

export interface MoveCardAction extends ActionBase {
  type: "move_card";
  from: Zone;
  to: Zone;
  cardId: string;
  toIndex?: number;                      // insertion index in destination zone
  asHidden?: boolean;                    // play face-down (requires Hidden keyword)
  forced?: boolean;                      // engine internal (legality overrides)
}
export interface MoveCardsToTrashBatchAction extends ActionBase { type: "move_cards_to_trash_batch"; from: Zone; cardIds: string[]; }
export interface MoveOffBoardCardsBatchAction extends ActionBase { type: "move_off_board_cards_batch"; from: Zone; to: Zone; cardIds: string[]; }
export interface TransferCardControlAction extends ActionBase { type: "transfer_card_control"; zone: Zone; cardId: string; targetPlayerId?: string; }
export interface EquipCardAction extends ActionBase {
  type: "equip_card";
  equipmentCardId: string;
  unitCardId: string;
  asAttachment?: boolean;                // attach from hand as gear (Quick-Draw style)
}
export interface SendToDeckAction extends ActionBase { type: "send_to_deck"; from: Zone; cardId: string; position: "top" | "bottom"; }
export interface SendToRuneDeckAction extends ActionBase { type: "send_to_rune_deck"; from: "runeArea"; cardId: string; position: "top" | "bottom"; }
export interface ToggleExhaustedAction extends ActionBase {
  type: "toggle_exhausted";
  zone: Zone;
  cardId: string;
  expectedExhausted: boolean;            // guard: card.exhausted must equal this
}
export interface SetRuneExhaustedAction extends ActionBase { type: "set_rune_exhausted"; cardId: string; exhausted: boolean; }  // rune_batch op only
export interface DrawCardsAction extends ActionBase { type: "draw_cards"; count?: number; to?: BoardZone | "banished"; }     // default 1 → hand
export interface DrawRuneAction extends ActionBase { type: "draw_rune"; exhausted?: boolean; }                                // runeDeck top → runeArea
export interface TakeTopFromDeckAction extends ActionBase { type: "take_top_from_deck"; to: BoardZone | "banished"; sourceCardId?: string; }
export interface TakeCardFromDeckAction extends ActionBase { type: "take_card_from_deck"; cardId: string; to: Zone; toIndex?: number; }
export interface RecycleAllTrashToDeckAction extends ActionBase { type: "recycle_all_trash_to_deck"; }
export interface SendRuneToDeckBottomAction extends ActionBase { type: "send_rune_to_deck_bottom"; cardId: string; paymentGroupOrigin?: string; }
export interface RecycleRuneForFloatingEnergyAction extends ActionBase {
  type: "recycle_rune_for_floating_energy";
  cardId: string;
  paymentGroupOrigin?: "auto_pay_button" | (string & {});   // auto-pay recycle does NOT grant floating power
}
export interface ShuffleDeckAction extends ActionBase { type: "shuffle_deck"; preserveRecycledBottom?: boolean; }
export interface CreateTokenAction extends ActionBase {
  type: "create_token";
  zone: Zone;
  name: string;
  count?: number;                        // default 1
  exhausted?: boolean;                   // default from token defaults (cs.h)
  clientCardIds?: string[];              // client-generated ids (merged/compacted)
}
export interface DuplicateCardAction extends ActionBase {
  type: "duplicate_card";
  zone: Zone;
  cardId: string;
  owner?: "self" | "opponent";
  targetPlayerId?: string;
  clientCardId?: string;
}
export interface UnlinkBanishedCardAction extends ActionBase { type: "unlink_banished_card"; zone: BattlefieldZone; cardId: string; targetCardId: string; }
export interface DocksideBanishUnitAction extends ActionBase { type: "dockside_banish_unit"; zone: BattlefieldZone; cardId: string; targetCardId: string; }
export interface DocksidePlayBanishedAction extends ActionBase { type: "dockside_play_banished"; zone: BattlefieldZone; cardId: string; banishedCardId: string; to: Zone; }
export interface KharoxPlayFromTrashAction extends ActionBase { type: "kharox_play_from_trash"; zone: BattlefieldZone; cardId: string; targetPlayerId: string; trashCardId: string; to: Zone; }

/* ==================================================================== 6. DECK PEEK / REVEAL (action_intent) */

export interface PeekDeckTopAction extends ActionBase { type: "peek_deck_top"; count?: number; zone?: "deck" | "runeDeck"; }
export interface PeekDeckBottomAction extends ActionBase { type: "peek_deck_bottom"; }
export interface ClearDeckPeekAction extends ActionBase { type: "clear_deck_peek"; zone?: "deck" | "runeDeck"; }
export interface DismissDeckPeekAction extends ActionBase { type: "dismiss_deck_peek"; zone?: "deck" | "runeDeck"; }
export interface RecycleDeckPeekCardAction extends ActionBase { type: "recycle_deck_peek_card"; cardId: string; zone?: "deck" | "runeDeck"; }
export interface PutDeckPeekCardOnTopAction extends ActionBase { type: "put_deck_peek_card_on_top"; cardId: string; zone?: "deck" | "runeDeck"; }
export interface SetDeckPeekCardRevealAction extends ActionBase {
  type: "set_deck_peek_card_reveal";
  cardId: string;
  reveal: boolean;
  zone?: "deck" | "runeDeck";
  targetPlayerId?: string;               // per-recipient reveal
  audience?: "all_other_players" | "teammates" | "opponents";
  autoRevealNewCards?: boolean;
}
export interface SetDeckPeekCardsRevealAction extends ActionBase {
  type: "set_deck_peek_cards_reveal";
  cardIds: string[];
  reveal: boolean;
  zone?: "deck" | "runeDeck";
  autoRevealNewCards?: boolean;
}
export interface SetHandRevealAction extends ActionBase {
  type: "set_hand_reveal";
  reveal: boolean;
  targetPlayerId?: string;
  audience?: "all_other_players" | "teammates" | "opponents";
}
export interface SetCardRevealedToOpponentAction extends ActionBase {
  type: "set_card_revealed_to_opponent";
  zone: Zone;
  cardId: string;
  revealed: boolean;
  targetPlayerId?: string;
  audience?: "all_other_players" | "teammates" | "opponents";
}
export interface SetCardHiddenAction extends ActionBase {
  type: "set_card_hidden";
  zone?: Zone;                           // default "hand"
  cardId: string;
  hidden: boolean;                       // true = face-down; false = reveal (may auto-move to base / exhaust)
}

/* ==================================================================== 7. PAYMENT / RESOURCES / COUNTERS (action_intent) */

export interface PaymentBatchAction extends ActionBase {
  type: "payment_batch";
  operations: PaymentOperation[];        // ≤128
  paymentGroupOrigin?: "auto_pay_button" | (string & {});
  /** server expands this into `operations` when supplied */
  autoPay?: { purpose: "play" | "empower"; zone: Zone; cardId: string };
}
export type PaymentOperation =
  | { type: "toggle_exhausted"; zone: Zone; cardId: string; expectedExhausted: boolean }
  | { type: "adjust_floating_resource"; resource: "energy" | "power"; delta: number }   // negative only
  | { type: "send_rune_to_deck_bottom"; cardId: string }
  | { type: "recycle_rune_for_floating_energy"; cardId: string }
  | { type: "set_card_label"; zone: Zone; cardId: string; slot: 0 | 1 | 2; label: string };

export interface RuneBatchAction extends ActionBase {
  type: "rune_batch";
  operations: RuneOperation[];           // ≤128
}
export type RuneOperation =
  | { type: "draw_rune"; exhausted?: boolean }
  | { type: "set_rune_exhausted"; cardId: string; exhausted: boolean }
  | { type: "send_rune_to_deck_bottom"; cardId: string }
  | { type: "recycle_rune_for_floating_energy"; cardId: string };

export interface FloatingResourceBatchAction extends ActionBase {
  type: "floating_resource_batch";
  operations: Array<
    | { type: "adjust_floating_resource"; resource: "energy" | "power"; delta: number }
    | { type: "clear_floating_resources" }
  >;
}
export interface AdjustFloatingResourceAction extends ActionBase {
  type: "adjust_floating_resource";
  resource: "energy" | "power";
  delta: number;                         // integer, non-zero, may be negative (spend)
  paymentGroupOrigin?: "auto_pay_button" | (string & {});
}
export interface ClearFloatingResourcesAction extends ActionBase { type: "clear_floating_resources"; }
export interface AdjustLegendXpAction extends ActionBase { type: "adjust_legend_xp"; delta: number; }   // clamped 0..99
export interface SetScoreAction extends ActionBase { type: "set_score"; score: number; }               // clamped -99..99 (duel: ≥0)
export interface AdjustScoreAction extends ActionBase { type: "adjust_score"; delta: number; }
export interface AdjustCardMightAction extends ActionBase { type: "adjust_card_might"; zone: Zone; cardId: string; delta: number; }
export interface AdjustCardCounterAction extends ActionBase {
  type: "adjust_card_counter";
  zone: Zone;
  cardId: string;
  counter: "white" | "red";
  delta: number;
  /** white counter on a unit starts at its printed might */
  initializeAtUnitMight?: boolean;
}
export interface ClearCardCounterAction extends ActionBase { type: "clear_card_counter"; zone: Zone; cardId: string; counter: "white" | "red"; }
export interface SetCardLabelAction extends ActionBase {
  type: "set_card_label";
  owner?: "self" | "opponent";
  targetPlayerId?: string;
  zone: Zone;
  cardId: string;
  slot: 0 | 1 | 2;
  label: string;
  /** +1/-1 adjusts the trailing count of a counted label (e.g. "Shield 2") */
  countDelta?: 1 | -1;
}
export interface SetBattlefieldBrushAction extends ActionBase { type: "set_battlefield_brush"; zone: BattlefieldZone; active: boolean; }  // requires Baron Pit
export interface AnimateOriannaGearAction extends ActionBase { type: "animate_orianna_gear"; legendId: string; zone: Zone; cardId: string; }
export interface ChooseNeekoLegendAction extends ActionBase {
  type: "choose_neeko_legend";
  neekoCardId: string;
  zone: Zone;
  legendId: string | null;               // null = return legend to Additional Legends
}

/* ==================================================================== 8. CHAIN / SHOWDOWN (action_intent) */

export interface ChainAddAction extends ActionBase {
  type: "chain_add";
  from: Zone | "battlefieldMarker";      // "battlefieldMarker" plays the battlefield itself (Baron Pit etc.)
  cardId: string;
  clientEntryId?: string;                // "chain_<n>_<n>" (dedupe/optimistic merge)
  battlefieldZone?: BattlefieldZone;     // when from = battlefieldMarker
}
export interface ChainResolveAction extends ActionBase { type: "chain_resolve"; entryId: string; to?: Zone | "deck_top" | "deck_bottom" | "hand"; }
export interface ChainSetRepeatAction extends ActionBase { type: "chain_set_repeat"; entryId: string; enabled: boolean; }
export interface ChainSetFlowAction extends ActionBase { type: "chain_set_flow"; entryId: string; enabled: boolean; }
export interface ChainSetResolveVoteAction extends ActionBase { type: "chain_set_resolve_vote"; entryId: string; approved: boolean; }
export interface BattlefieldConquerPassFocusAction extends ActionBase { type: "battlefield_conquer_pass_focus"; zone: BattlefieldZone; }
export interface BattlefieldConquerPassResponseAction extends ActionBase { type: "battlefield_conquer_pass_response"; zone: BattlefieldZone; }
export interface BattlefieldConquerSetOptionalPassAction extends ActionBase { type: "battlefield_conquer_set_optional_pass"; zone: BattlefieldZone; passed: boolean; }
export interface BattlefieldConquerDismissAction extends ActionBase { type: "battlefield_conquer_dismiss"; zone: BattlefieldZone; }
export interface BattlefieldConquerConfirmAction extends ActionBase { type: "battlefield_conquer_confirm"; zone: BattlefieldZone; }

/* ==================================================================== 9. DICE / REWIND (action_intent) */

export interface RollDieAction extends ActionBase { type: "roll_die"; sides: 4 | 6 | 8 | 10 | 12 | 20; }   // server RNG
export interface RewindLastActionAction extends ActionBase { type: "rewind_last_action"; }
export interface ForwardLastRewindAction extends ActionBase { type: "forward_last_rewind"; }
export interface RespondRewindConfirmationAction extends ActionBase {
  type: "respond_rewind_confirmation";
  requestId: string;
  response: "approve" | "decline" | "cancel";   // approver: approve/decline; requester: cancel
}

/* ==================================================================== 10. COORDINATION ARROWS (action_intent) */

export interface TargetArrowAddAction extends ActionBase {
  type: "target_arrow_add";
  sourceCardId: string;
  targetCardId: string;
  sourceAnchor: "board" | "chain";
  targetAnchor: "board" | "chain";
}
export interface TargetArrowRemoveAction extends ActionBase {
  type: "target_arrow_remove";
  sourceCardId: string;
  targetCardId: string;
  sourceAnchor: "board" | "chain";
  targetAnchor: "board" | "chain";
}
export interface TargetArrowRemoveFromSourceAction extends ActionBase {
  type: "target_arrow_remove_from_source";
  sourceCardId: string;
  sourceAnchor: "board" | "chain";
}
export interface TargetArrowClearAllAction extends ActionBase { type: "target_arrow_clear_all"; }

/* ==================================================================== 11. CLIENT-LOCAL UI ACTIONS (never sent; InteractionState reducer) */

export interface LocalUiActions {
  replace_state: { value: unknown };
  set_armed_action: { value: InteractionArmedAction };
  set_held_mode: { mode: "counterAdd" | "buff" | "target" | "ping"; active: boolean };
  set_target_selection: { value: unknown };
  set_target_prompt_pos: { value: unknown };
  set_target_hotkey_source_key: { value: unknown };
  set_label_selection: { value: unknown };
  set_label_dialog_state: { value: unknown };
  set_label_wheel_state: { value: unknown };
  set_label_prompt_pos: { value: unknown };
  set_label_hotkey_active: { value: boolean };
  set_label_wheel_open_source: { value: unknown };
  set_pending_chain_resolve_entry_id: { value: string | null };
  set_queued_targeted_spell_drop_arrow: { value: unknown };
  set_auto_pay_preview_card_id: { value: string | null };
  set_auto_pay_in_flight: { value: boolean };
}
export type InteractionArmedAction =
  | { kind: "none" }
  | { kind: "equip"; cardId: string }
  | { kind: "label" }
  | { kind: "duplicate" }
  | { kind: "transfer_control" }
  | { kind: "play_hidden"; cardId: string; from: Zone };

/* ==================================================================== unions */

export type GameplayAction =
  | EndTurnAction | EndBeginningPhaseAction | SetExtraTurnAction
  | SetShowLegendXpCounterAction | SetStopAtBeginningPhaseAction | SetSkipDrawPhaseAction | SetAutoScoreFromHoldAction
  | MoveCardAction | MoveCardsToTrashBatchAction | MoveOffBoardCardsBatchAction | TransferCardControlAction | EquipCardAction
  | SendToDeckAction | SendToRuneDeckAction | ToggleExhaustedAction | SetRuneExhaustedAction
  | DrawCardsAction | DrawRuneAction | TakeTopFromDeckAction | TakeCardFromDeckAction | RecycleAllTrashToDeckAction
  | SendRuneToDeckBottomAction | RecycleRuneForFloatingEnergyAction | ShuffleDeckAction
  | CreateTokenAction | DuplicateCardAction | UnlinkBanishedCardAction | DocksideBanishUnitAction
  | DocksidePlayBanishedAction | KharoxPlayFromTrashAction
  | PeekDeckTopAction | PeekDeckBottomAction | ClearDeckPeekAction | DismissDeckPeekAction
  | RecycleDeckPeekCardAction | PutDeckPeekCardOnTopAction | SetDeckPeekCardRevealAction | SetDeckPeekCardsRevealAction
  | SetHandRevealAction | SetCardRevealedToOpponentAction | SetCardHiddenAction
  | PaymentBatchAction | RuneBatchAction | FloatingResourceBatchAction | AdjustFloatingResourceAction | ClearFloatingResourcesAction
  | AdjustLegendXpAction | SetScoreAction | AdjustScoreAction | AdjustCardMightAction | AdjustCardCounterAction | ClearCardCounterAction
  | SetCardLabelAction | SetBattlefieldBrushAction | AnimateOriannaGearAction | ChooseNeekoLegendAction
  | ChainAddAction | ChainResolveAction | ChainSetRepeatAction | ChainSetFlowAction | ChainSetResolveVoteAction
  | BattlefieldConquerPassFocusAction | BattlefieldConquerPassResponseAction | BattlefieldConquerSetOptionalPassAction
  | BattlefieldConquerDismissAction | BattlefieldConquerConfirmAction
  | RollDieAction | RewindLastActionAction | ForwardLastRewindAction | RespondRewindConfirmationAction
  | TargetArrowAddAction | TargetArrowRemoveAction | TargetArrowRemoveFromSourceAction | TargetArrowClearAllAction
  /** Strict-rules intents (§3). Legal only when `Room.rulesMode === "strict"` and in game. */
  | RulesWireAction;

export type RoomShellAction =
  | AddSoloOpponentAction | SetLobbyReadyAction | SwitchLobbySeatAction | RandomizeLobbyTeamsAction
  | SetLobbyPlayModeAction | SetLobbyDeckRulesAction | SetLobbyGameVariantAction | SetLobbyMatchFormatAction
  | StartLobbyMatchAction | SubmitDeckAction | SubmitSealedDraftAction
  | SubmitSideboardAction | RequestSideboardSkipAction | RespondSideboardSkipAction | SelectBattlefieldAction
  | AutoStartTestSetupAction | ConfirmSoloSetupAction | RollInitiativeAction | ChooseFirstPlayerAction
  | ChooseSinglePlayerTurnOrderAction | SubmitMulliganAction
  | RequestGameResultConfirmationAction | CancelGameResultConfirmationAction | ReportGameResultAction | RequestBo3RematchAction
  /** Strict-rules lobby toggle (§3). Host only, lobby phase. */
  | SetLobbyRulesModeAction;

export type WireAction = GameplayAction | RoomShellAction;

/* ==================================================================== room HTTP API (PartyKit host) */

export type RoomApiAction =
  | { action: "create_room"; [k: string]: unknown }                       // → /parties/coordinator/global-enam-v1
  | { action: "join_room" } | { action: "switch_to_spectator" } | { action: "take_seat" }
  | { action: "resolve_room_membership" } | { action: "create_next_game" }
  | { action: "room_series_action" } | { action: "leave_room" }
  | { action: "abandon_match" } | { action: "claim_disconnect_win" }
  | { action: "return_to_lobby" }                                         // all on /parties/match/:roomCode
  | { action: "reset_exact" } | { action: "cancel_exact" };               // on /parties/matchmaking/:queueRoom

/**
 * Optimistic-application set `cV` (35qz5rkx7yexy.js:24296-24368): the client locally applies exactly
 * these action types to the projected room before/while the server confirms. All other gameplay
 * actions wait for the authoritative patch. `end_turn` and `roll_die` are server-only.
 */
export const OPTIMISTIC_ACTIONS: ReadonlySet<string> = new Set([
  /* verbatim contents of `cV` in 35qz5rkx7yexy.js:24296-24368 */
  "peek_deck_top", "peek_deck_bottom", "clear_deck_peek", "dismiss_deck_peek",
  "recycle_deck_peek_card", "put_deck_peek_card_on_top", "set_deck_peek_card_reveal",
  "set_deck_peek_cards_reveal", "shuffle_deck", "set_hand_reveal", "set_card_hidden",
  "set_card_revealed_to_opponent", "draw_cards", "take_top_from_deck", "unlink_banished_card",
  "dockside_banish_unit", "dockside_play_banished", "kharox_play_from_trash", "take_card_from_deck",
  "draw_rune", "send_rune_to_deck_bottom", "recycle_rune_for_floating_energy", "send_to_rune_deck",
  "move_card", "move_cards_to_trash_batch", "move_off_board_cards_batch", "transfer_card_control",
  "equip_card", "recycle_all_trash_to_deck", "send_to_deck", "toggle_exhausted", "set_score",
  "adjust_score", "end_beginning_phase", "set_show_legend_xp_counter", "set_stop_at_beginning_phase",
  "set_skip_draw_phase", "set_auto_score_from_hold", "floating_resource_batch",
  "adjust_floating_resource", "adjust_legend_xp", "clear_floating_resources", "adjust_card_might",
  "adjust_card_counter", "clear_card_counter", "set_card_label", "rune_batch", "payment_batch",
  "create_token", "set_battlefield_brush", "duplicate_card", "chain_add", "chain_set_repeat",
  "chain_set_flow", "set_extra_turn", "chain_resolve", "battlefield_conquer_pass_focus",
  "battlefield_conquer_pass_response", "battlefield_conquer_set_optional_pass",
  "battlefield_conquer_dismiss", "battlefield_conquer_confirm", "target_arrow_add",
  "target_arrow_remove", "target_arrow_remove_from_source", "target_arrow_clear_all",
]);
