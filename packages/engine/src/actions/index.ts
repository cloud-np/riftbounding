/**
 * Wire action → handler map. Keys are the exact original action type strings.
 * See PORTING.md for the action checklist and original line references.
 */
import type { ActionHandler } from "../types";
import { rollDie } from "./dice";
import {
  setAutoScoreFromHold,
  setShowLegendXpCounter,
  setSkipDrawPhase,
  setStopAtBeginningPhase,
} from "./settings";
import { endBeginningPhaseAction, endTurnAction, setExtraTurnAction } from "./turn";
import { adjustLegendXp, adjustScore, setScore } from "./score";
import {
  adjustFloatingResource,
  clearFloatingResources,
  drawRune,
  floatingResourceBatch,
  recycleRuneForFloatingEnergy,
  runeBatch,
  sendRuneToDeckBottom,
  sendToRuneDeck,
  setRuneExhausted,
} from "./resources";
import { paymentBatch } from "./payment";
import {
  createToken,
  drawCards,
  duplicateCard,
  equipCard,
  moveCardAction,
  moveCardsToTrashBatch,
  moveOffBoardCardsBatch,
  recycleAllTrashToDeck,
  sendToDeckAction,
  shuffleDeck,
  takeCardFromDeckAction,
  takeTopFromDeck,
  toggleExhausted,
  transferCardControlAction,
} from "./movement";
import {
  animateOriannaGear,
  chooseNeekoLegend,
  docksideBanishUnit,
  docksidePlayBanished,
  kharoxPlayFromTrash,
  unlinkBanishedCard,
} from "./cardHelpers";
import {
  adjustCardCounter,
  adjustCardMight,
  clearCardCounter,
  setBattlefieldBrush,
  setCardLabelAction,
} from "./counters";
import {
  clearDeckPeek,
  dismissDeckPeek,
  peekDeckBottom,
  peekDeckTop,
  putDeckPeekCardOnTop,
  recycleDeckPeekCard,
  setDeckPeekCardReveal,
} from "./deckPeek";
import { setCardHidden, setCardRevealedToOpponent, setHandReveal } from "./reveal";
import { battlefieldConquer, chainAdd, chainResolve, chainSetFlow, chainSetRepeat, chainSetResolveVote } from "./chain";
import { targetArrows } from "./arrows";
import {
  addSoloOpponent,
  randomizeLobbyTeams,
  setLobbyDeckRules,
  setLobbyGameVariant,
  setLobbyMatchFormat,
  setLobbyPlayMode,
  setLobbyReady,
  startLobbyMatch,
  submitDeck,
  submitSealedDraft,
  switchLobbySeat,
} from "./lobby";
import {
  autoStartTestSetup,
  cancelGameResultConfirmation,
  chooseFirstPlayer,
  chooseSinglePlayerTurnOrder,
  confirmSoloSetup,
  reportGameResult,
  requestBo3Rematch,
  requestGameResultConfirmation,
  requestSideboardSkip,
  respondSideboardSkip,
  rollInitiative,
  selectBattlefield,
  submitMulligan,
  submitSideboard,
} from "./setup";

export const ACTION_HANDLERS: Record<string, ActionHandler> = {
  /* lobby / room shell */
  add_solo_opponent: addSoloOpponent,
  set_lobby_ready: setLobbyReady,
  switch_lobby_seat: switchLobbySeat,
  randomize_lobby_teams: randomizeLobbyTeams,
  set_lobby_play_mode: setLobbyPlayMode,
  set_lobby_deck_rules: setLobbyDeckRules,
  set_lobby_game_variant: setLobbyGameVariant,
  set_lobby_match_format: setLobbyMatchFormat,
  start_lobby_match: startLobbyMatch,
  submit_deck: submitDeck,
  submit_sealed_draft: submitSealedDraft,

  /* setup */
  submit_sideboard: submitSideboard,
  request_sideboard_skip: requestSideboardSkip,
  respond_sideboard_skip: respondSideboardSkip,
  select_battlefield: selectBattlefield,
  auto_start_test_setup: autoStartTestSetup,
  confirm_solo_setup: confirmSoloSetup,
  roll_initiative: rollInitiative,
  choose_first_player: chooseFirstPlayer,
  choose_single_player_turn_order: chooseSinglePlayerTurnOrder,
  submit_mulligan: submitMulligan,

  /* game result */
  request_game_result_confirmation: requestGameResultConfirmation,
  cancel_game_result_confirmation: cancelGameResultConfirmation,
  report_game_result: reportGameResult,
  request_bo3_rematch: requestBo3Rematch,

  /* turn structure */
  end_turn: endTurnAction,
  end_beginning_phase: endBeginningPhaseAction,
  set_extra_turn: setExtraTurnAction,
  set_show_legend_xp_counter: setShowLegendXpCounter,
  set_stop_at_beginning_phase: setStopAtBeginningPhase,
  set_skip_draw_phase: setSkipDrawPhase,
  set_auto_score_from_hold: setAutoScoreFromHold,

  /* card movement */
  move_card: moveCardAction,
  move_cards_to_trash_batch: moveCardsToTrashBatch,
  move_off_board_cards_batch: moveOffBoardCardsBatch,
  transfer_card_control: transferCardControlAction,
  equip_card: equipCard,
  send_to_deck: sendToDeckAction,
  send_to_rune_deck: sendToRuneDeck,
  toggle_exhausted: toggleExhausted,
  set_rune_exhausted: setRuneExhausted,
  draw_cards: drawCards,
  draw_rune: drawRune,
  take_top_from_deck: takeTopFromDeck,
  take_card_from_deck: takeCardFromDeckAction,
  recycle_all_trash_to_deck: recycleAllTrashToDeck,
  send_rune_to_deck_bottom: sendRuneToDeckBottom,
  recycle_rune_for_floating_energy: recycleRuneForFloatingEnergy,
  shuffle_deck: shuffleDeck,
  create_token: createToken,
  duplicate_card: duplicateCard,
  unlink_banished_card: unlinkBanishedCard,
  dockside_banish_unit: docksideBanishUnit,
  dockside_play_banished: docksidePlayBanished,
  kharox_play_from_trash: kharoxPlayFromTrash,

  /* deck peek / reveal */
  peek_deck_top: peekDeckTop,
  peek_deck_bottom: peekDeckBottom,
  clear_deck_peek: clearDeckPeek,
  dismiss_deck_peek: dismissDeckPeek,
  recycle_deck_peek_card: recycleDeckPeekCard,
  put_deck_peek_card_on_top: putDeckPeekCardOnTop,
  set_deck_peek_card_reveal: setDeckPeekCardReveal,
  set_deck_peek_cards_reveal: setDeckPeekCardReveal,
  set_hand_reveal: setHandReveal,
  set_card_revealed_to_opponent: setCardRevealedToOpponent,
  set_card_hidden: setCardHidden,

  /* payment / resources / counters */
  payment_batch: paymentBatch,
  rune_batch: runeBatch,
  floating_resource_batch: floatingResourceBatch,
  adjust_floating_resource: adjustFloatingResource,
  clear_floating_resources: clearFloatingResources,
  adjust_legend_xp: adjustLegendXp,
  set_score: setScore,
  adjust_score: adjustScore,
  adjust_card_might: adjustCardMight,
  adjust_card_counter: adjustCardCounter,
  clear_card_counter: clearCardCounter,
  set_card_label: setCardLabelAction,
  set_battlefield_brush: setBattlefieldBrush,
  animate_orianna_gear: animateOriannaGear,
  choose_neeko_legend: chooseNeekoLegend,

  /* chain / showdown */
  chain_add: chainAdd,
  chain_resolve: chainResolve,
  chain_set_repeat: chainSetRepeat,
  chain_set_flow: chainSetFlow,
  chain_set_resolve_vote: chainSetResolveVote,
  battlefield_conquer_pass_focus: battlefieldConquer,
  battlefield_conquer_pass_response: battlefieldConquer,
  battlefield_conquer_set_optional_pass: battlefieldConquer,
  battlefield_conquer_dismiss: battlefieldConquer,
  battlefield_conquer_confirm: battlefieldConquer,

  /* dice / coordination */
  roll_die: rollDie,
  target_arrow_add: targetArrows,
  target_arrow_remove: targetArrows,
  target_arrow_remove_from_source: targetArrows,
  target_arrow_clear_all: targetArrows,
};

export const GAMEPLAY_ACTION_TYPES: ReadonlySet<string> = new Set([
  ...Object.keys(ACTION_HANDLERS).filter(
    (type) =>
      ![
        "add_solo_opponent",
        "set_lobby_ready",
        "switch_lobby_seat",
        "randomize_lobby_teams",
        "set_lobby_play_mode",
        "set_lobby_deck_rules",
        "set_lobby_game_variant",
        "set_lobby_match_format",
        "start_lobby_match",
        "submit_deck",
        "submit_sealed_draft",
        "submit_sideboard",
        "request_sideboard_skip",
        "respond_sideboard_skip",
        "select_battlefield",
        "auto_start_test_setup",
        "confirm_solo_setup",
        "roll_initiative",
        "choose_first_player",
        "choose_single_player_turn_order",
        "submit_mulligan",
        "request_game_result_confirmation",
        "cancel_game_result_confirmation",
        "report_game_result",
        "request_bo3_rematch",
        "rewind_last_action",
        "forward_last_rewind",
        "respond_rewind_confirmation",
      ].includes(type),
  ),
]);

export const REWIND_ACTION_TYPES: ReadonlySet<string> = new Set([
  "rewind_last_action",
  "forward_last_rewind",
  "respond_rewind_confirmation",
]);
