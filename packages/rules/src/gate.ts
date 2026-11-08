/**
 * Strict-mode gate for the original sandbox actions — §4.
 *
 * `@rift/engine` calls this for every non-`rules_*` gameplay action while `Room.rulesMode` is
 * `"strict"`. Cosmetic/meta actions are always allowed; while the §6.4 manual window is open its
 * player may use the relevant board actions.
 */
import type { Room, Verdict } from "@rift/protocol";
import { fail } from "./types";

/** Dice, arrows/pings, board settings, card labels (contract §4). */
const COSMETIC_ACTIONS: ReadonlySet<string> = new Set([
  "roll_die",
  "target_arrow_add",
  "target_arrow_remove",
  "target_arrow_remove_from_source",
  "target_arrow_clear_all",
  "set_show_legend_xp_counter",
  "set_stop_at_beginning_phase",
  "set_skip_draw_phase",
  "set_auto_score_from_hold",
  "set_battlefield_brush",
  "set_card_label",
]);

/** Board actions the §6.4 manual-resolution player may take until `rules_manual_done`. */
const MANUAL_ACTIONS: ReadonlySet<string> = new Set([
  "move_card",
  "move_cards_to_trash_batch",
  "move_off_board_cards_batch",
  "transfer_card_control",
  "equip_card",
  "send_to_deck",
  "send_to_rune_deck",
  "toggle_exhausted",
  "set_rune_exhausted",
  "draw_cards",
  "draw_rune",
  "take_top_from_deck",
  "take_card_from_deck",
  "recycle_all_trash_to_deck",
  "send_rune_to_deck_bottom",
  "recycle_rune_for_floating_energy",
  "shuffle_deck",
  "create_token",
  "duplicate_card",
  "unlink_banished_card",
  "dockside_banish_unit",
  "dockside_play_banished",
  "kharox_play_from_trash",
  "peek_deck_top",
  "peek_deck_bottom",
  "clear_deck_peek",
  "dismiss_deck_peek",
  "recycle_deck_peek_card",
  "put_deck_peek_card_on_top",
  "set_deck_peek_card_reveal",
  "set_deck_peek_cards_reveal",
  "set_hand_reveal",
  "set_card_revealed_to_opponent",
  "set_card_hidden",
  "payment_batch",
  "rune_batch",
  "floating_resource_batch",
  "adjust_floating_resource",
  "clear_floating_resources",
  "adjust_legend_xp",
  "set_score",
  "adjust_score",
  "adjust_card_might",
  "adjust_card_counter",
  "clear_card_counter",
  "animate_orianna_gear",
  "choose_neeko_legend",
  "set_extra_turn",
]);

export function isCosmeticAction(actionType: string): boolean {
  return COSMETIC_ACTIONS.has(actionType);
}

export function isManualBoardAction(actionType: string): boolean {
  return MANUAL_ACTIONS.has(actionType);
}

/** True when the action is allowed for the actor in a strict room. */
export function gate(room: Room, actorId: string, actionType: string): Verdict {
  if (room.rulesMode !== "strict") return { ok: true };
  if (actionType.startsWith("rules_")) return { ok: true };
  if (COSMETIC_ACTIONS.has(actionType)) return { ok: true };
  const manual = room.rules?.manual;
  if (manual && manual.player === actorId && MANUAL_ACTIONS.has(actionType)) return { ok: true };
  if (manual && manual.player === actorId) {
    return fail("strict_mode_action", "contract:§4", `${actionType} is not a manual board action`);
  }
  return fail("strict_mode_action", "contract:§4", `${actionType} is disabled in strict mode`);
}
