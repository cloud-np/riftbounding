import { describe, expect, it } from "vitest";

import { ACTION_HANDLERS, REWIND_ACTION_TYPES } from "../src/actions";

const WIRE_ACTIONS = [
  // lobby / room shell
  "add_solo_opponent", "set_lobby_ready", "switch_lobby_seat", "randomize_lobby_teams",
  "set_lobby_play_mode", "set_lobby_deck_rules", "set_lobby_game_variant",
  "set_lobby_match_format", "start_lobby_match", "submit_deck", "submit_sealed_draft",
  // setup
  "submit_sideboard", "request_sideboard_skip", "respond_sideboard_skip",
  "select_battlefield", "auto_start_test_setup", "confirm_solo_setup", "roll_initiative",
  "choose_first_player", "choose_single_player_turn_order", "submit_mulligan",
  // game result
  "request_game_result_confirmation", "cancel_game_result_confirmation",
  "report_game_result", "request_bo3_rematch",
  // turn
  "end_turn", "end_beginning_phase", "set_extra_turn", "set_show_legend_xp_counter",
  "set_stop_at_beginning_phase", "set_skip_draw_phase", "set_auto_score_from_hold",
  // movement
  "move_card", "move_cards_to_trash_batch", "move_off_board_cards_batch",
  "transfer_card_control", "equip_card", "send_to_deck", "send_to_rune_deck",
  "toggle_exhausted", "set_rune_exhausted", "draw_cards", "draw_rune",
  "take_top_from_deck", "take_card_from_deck", "recycle_all_trash_to_deck",
  "send_rune_to_deck_bottom", "recycle_rune_for_floating_energy", "shuffle_deck",
  "create_token", "duplicate_card", "unlink_banished_card", "dockside_banish_unit",
  "dockside_play_banished", "kharox_play_from_trash",
  // deck peek / reveal
  "peek_deck_top", "peek_deck_bottom", "clear_deck_peek", "dismiss_deck_peek",
  "recycle_deck_peek_card", "put_deck_peek_card_on_top", "set_deck_peek_card_reveal",
  "set_deck_peek_cards_reveal", "set_hand_reveal", "set_card_revealed_to_opponent",
  "set_card_hidden",
  // payment / resources / counters
  "payment_batch", "rune_batch", "floating_resource_batch", "adjust_floating_resource",
  "clear_floating_resources", "adjust_legend_xp", "set_score", "adjust_score",
  "adjust_card_might", "adjust_card_counter", "clear_card_counter", "set_card_label",
  "set_battlefield_brush", "animate_orianna_gear", "choose_neeko_legend",
  // chain / showdown
  "chain_add", "chain_resolve", "chain_set_repeat", "chain_set_flow",
  "chain_set_resolve_vote", "battlefield_conquer_pass_focus",
  "battlefield_conquer_pass_response", "battlefield_conquer_set_optional_pass",
  "battlefield_conquer_dismiss", "battlefield_conquer_confirm",
  // dice / rewind
  "roll_die", "rewind_last_action", "forward_last_rewind", "respond_rewind_confirmation",
  // coordination arrows
  "target_arrow_add", "target_arrow_remove", "target_arrow_remove_from_source",
  "target_arrow_clear_all",
] as const;

describe("wire action coverage", () => {
  it("handles every wire action type", () => {
    const handled = new Set<string>([...Object.keys(ACTION_HANDLERS), ...REWIND_ACTION_TYPES]);
    expect(handled.size).toBe(99);
    for (const action of WIRE_ACTIONS) expect(handled.has(action), action).toBe(true);
    expect(new Set(WIRE_ACTIONS).size).toBe(99);
  });
});
