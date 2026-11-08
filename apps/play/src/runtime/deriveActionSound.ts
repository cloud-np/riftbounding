/**
 * `deriveActionSound(action, ctx)` — verbatim port of `.recon/pretty/playapp/0xawjzm3yjpr1.js`
 * ~53800-54000 (`cV` + `rf` + the `rs`/`ru`/`rm`/`rp` zone sets), with the victory-score clamp
 * (`rh`) and the conquer `drawCard/gainPoint` decision (`ej.N`/`ej.h` — ported structurally; the
 * exact conquer maths live in @rift/engine).
 *
 * Also exports the snapshot-driven sounds the original plays outside `cV`:
 *  - turn number increased while `in_game` → `turn_start`, or `time_warp` when
 *    `extraTurnResumePlayerId` is set (`0xawjzm3yjpr1.js:59340-59375`)
 *  - `game_start` when the in-game route mounts (`35qz5rkx7yexy.js:26606`) — exposed as
 *    `GAME_START_SOUND`
 *  - Baron Pit activation → `baron_nashor` (fire-once)
 */

import type {
  CardInstance,
  GameplayAction,
  PlayerBoard,
  Room,
  RoomShellAction,
  Zone,
} from "@rift/protocol";
import type { SfxKey } from "./sound";

/** `rs` — zones that mean "on the board" for `card_play`. */
const BOARD_ZONES: ReadonlySet<string> = new Set([
  "base",
  "battlefieldA",
  "battlefieldB",
  "battlefieldC",
  "battlefieldToken",
  "champion",
  "legend",
  "runeArea",
]);

/** `ru` — field zones (base + battlefields) for board→board moves. */
const FIELD_ZONES: ReadonlySet<string> = new Set([
  "base",
  "battlefieldA",
  "battlefieldB",
  "battlefieldC",
  "battlefieldToken",
]);

/** `rm` — zones whose cards carry an `exhausted` flag. */
const EXHAUSTIBLE_ZONES: ReadonlySet<string> = new Set([
  "hand",
  "base",
  "trash",
  "battlefieldA",
  "battlefieldB",
  "battlefieldC",
  "battlefieldToken",
  "banished",
  "champion",
  "legend",
  "runeArea",
]);

/** `rp` — action types that record a score timestamp for the board UI. */
export const SCORE_ACTION_TYPES: ReadonlySet<string> = new Set([
  "adjust_score",
  "battlefield_conquer_confirm",
  "end_beginning_phase",
  "end_turn",
  "set_score",
]);

export type SoundKey = SfxKey;

export const GAME_START_SOUND: SoundKey = "game_start";

export interface DeriveActionSoundContext {
  /** actor player id (`t.id` in the original) */
  actorPlayerId?: string;
  /** the actor's board *before* the action (optimistic intent or patch diff) */
  boardBefore: PlayerBoard;
  /** the room *before* the action (needed for conquer + victory score) */
  roomBefore?: Room;
  /** `509396.N(room)` — victory score for the current variant */
  victoryScore?: number;
}

/** `rh` — score clamp. */
export function clampScore(value: number): number {
  return Number.isFinite(value) ? Math.max(-99, Math.min(99, Math.trunc(value))) : 0;
}

/** `rf` — score-change sound selection. */
export function deriveScoreSound(input: {
  actionType: string;
  autoScoreFromHold?: boolean;
  nextScore: number;
  previousScore: number;
  victoryScore: number;
}): SoundKey | null {
  const { actionType, nextScore, previousScore, victoryScore } = input;
  if (nextScore <= previousScore) return null;
  if (previousScore < victoryScore && nextScore >= victoryScore) return "score_end";
  if (actionType === "battlefield_conquer_confirm") return "score_conquer";
  if (actionType === "set_score" || actionType === "adjust_score") return "score_generic";
  if (
    input.autoScoreFromHold ||
    actionType === "end_turn" ||
    actionType === "end_beginning_phase"
  ) {
    return "score_hold";
  }
  return "score_generic";
}

function zoneOf(board: PlayerBoard, zone: string): CardInstance[] | null {
  if (!EXHAUSTIBLE_ZONES.has(zone)) return null;
  const record = board as unknown as Record<string, CardInstance[] | undefined>;
  return record[zone] ?? null;
}

/**
 * The conquer reward decision (`ej.N`): `{ gainPoint, drawCard }`.
 * Structural port: the exact "all active battlefields would be scored" maths is the engine's job —
 * the caller may pass `conquerReward` explicitly when it knows the outcome (patch diff / optimistic
 * engine result). When absent we fall back to the victory-score heuristic.
 */
export interface ConquerReward {
  gainPoint: boolean;
  drawCard: boolean;
}

function defaultConquerReward(
  room: Room,
  actorPlayerId: string,
  board: PlayerBoard,
  victoryScore: number,
): ConquerReward | null {
  const assist = room.pendingBattlefieldConquerAssist;
  if (
    !assist ||
    assist.attackerPlayerId !== actorPlayerId ||
    assist.stage !== "attacker_confirm_conquer"
  ) {
    return null;
  }
  if (board.score >= victoryScore - 1) {
    // final point must come from the last remaining battlefield → draw instead of scoring
    return { gainPoint: false, drawCard: true };
  }
  return { gainPoint: true, drawCard: false };
}

/**
 * `cV` — sound for one action. Returns `null` when the original plays nothing.
 *
 * The `deriveScoreSound` step needs the *next* score; for `set_score`/`adjust_score` it is computed
 * from the delta, and for `battlefield_conquer_confirm` from `conquerReward` when supplied
 * (`ctx.conquerReward`), otherwise from the room's conquer-assist state.
 */
export function deriveActionSound(
  action: GameplayAction | RoomShellAction,
  ctx: DeriveActionSoundContext & { conquerReward?: ConquerReward | null },
): SoundKey | null {
  const { boardBefore } = ctx;
  const room = ctx.roomBefore;
  const victoryScore = ctx.victoryScore ?? 8;

  // score branch first (mirrors the original's `i` lookup before the type switch)
  if (action.type === "set_score") {
    return deriveScoreSound({
      actionType: action.type,
      previousScore: boardBefore.score,
      nextScore: clampScore(action.score),
      victoryScore,
    });
  }
  if (action.type === "adjust_score") {
    return deriveScoreSound({
      actionType: action.type,
      previousScore: boardBefore.score,
      nextScore: clampScore(boardBefore.score + action.delta),
      victoryScore,
    });
  }
  if (action.type === "battlefield_conquer_confirm") {
    const reward =
      ctx.conquerReward ??
      (room && ctx.actorPlayerId
        ? defaultConquerReward(room, ctx.actorPlayerId, boardBefore, victoryScore)
        : null);
    if (!reward) return null;
    if (reward.drawCard) return "card_draw";
    return deriveScoreSound({
      actionType: action.type,
      previousScore: boardBefore.score,
      nextScore: Math.min(victoryScore, boardBefore.score + 1),
      victoryScore,
    });
  }

  switch (action.type) {
    case "payment_batch":
      return action.paymentGroupOrigin === "auto_pay_button" ? "card_autopay" : null;
    case "rewind_last_action":
      return "game_rewind";
    case "forward_last_rewind":
      return "game_forward";
    case "submit_sideboard":
    case "request_sideboard_skip":
    case "respond_sideboard_skip":
    case "submit_mulligan":
    case "request_game_result_confirmation":
    case "cancel_game_result_confirmation":
    case "report_game_result":
    case "request_bo3_rematch":
      return "ui_confirm";
    case "choose_first_player":
    case "choose_single_player_turn_order":
    case "battlefield_conquer_pass_focus":
    case "battlefield_conquer_pass_response":
    case "battlefield_conquer_set_optional_pass":
    case "battlefield_conquer_dismiss":
    case "set_battlefield_brush":
    case "set_deck_peek_card_reveal":
    case "set_deck_peek_cards_reveal":
    case "set_hand_reveal":
    case "set_card_revealed_to_opponent":
    case "set_show_legend_xp_counter":
    case "set_stop_at_beginning_phase":
    case "set_skip_draw_phase":
    case "set_auto_score_from_hold":
    case "chain_set_repeat":
    case "chain_set_flow":
    case "chain_set_resolve_vote":
    case "dismiss_deck_peek":
    case "clear_deck_peek":
    case "peek_deck_bottom":
    case "shuffle_deck":
    case "roll_initiative":
      return "ui_click";
    case "select_battlefield":
    case "target_arrow_add":
    case "target_arrow_remove":
    case "target_arrow_remove_from_source":
    case "target_arrow_clear_all":
    case "equip_card":
    case "adjust_card_counter":
    case "clear_card_counter":
    case "adjust_card_might":
    case "set_card_label":
      return "card_click";
    case "draw_cards":
      if (boardBefore.deck.length === 0) return null;
      if (!action.to || action.to === "hand") return "card_draw";
      return action.to === "trash" ? "card_discard" : null;
    case "draw_rune":
      return boardBefore.runeDeck.length > 0 ? "card_draw" : null;
    case "take_top_from_deck":
    case "take_card_from_deck": {
      const to = action.to;
      if (to === "hand") return "card_draw";
      if (to === "trash") return "card_discard";
      return BOARD_ZONES.has(to) ? "card_play" : null;
    }
    case "rune_batch":
      if (
        action.operations.some(
          (op) =>
            op.type === "send_rune_to_deck_bottom" ||
            op.type === "recycle_rune_for_floating_energy",
        )
      ) {
        return "card_recycle";
      }
      if (action.operations.some((op) => op.type === "draw_rune")) return "card_draw";
      if (action.operations.some((op) => op.type === "set_rune_exhausted")) return "card_exhaust";
      return null;
    case "send_rune_to_deck_bottom":
    case "recycle_rune_for_floating_energy":
      return action.paymentGroupOrigin === "auto_pay_button" ? null : "card_recycle";
    case "send_to_rune_deck":
    case "send_to_deck":
    case "recycle_deck_peek_card":
    case "recycle_all_trash_to_deck":
      return "card_recycle";
    case "move_card": {
      if (action.to === "trash") return "card_discard";
      if (action.from === "hand" && BOARD_ZONES.has(action.to)) return "card_play_from_hand";
      if (FIELD_ZONES.has(action.from) && FIELD_ZONES.has(action.to)) return "card_play";
      return null;
    }
    case "move_cards_to_trash_batch":
      return action.cardIds.length > 0 ? "card_discard" : null;
    case "move_off_board_cards_batch":
      if (action.cardIds.length === 0) return null;
      if (action.to === "deck") return "card_recycle";
      if (action.to === "trash") return "card_discard";
      return null;
    case "chain_add":
      return action.from === "hand" ? "card_play_from_hand" : "card_play";
    case "create_token":
    case "duplicate_card":
    case "dockside_play_banished":
    case "kharox_play_from_trash":
      return "card_play";
    case "toggle_exhausted": {
      if ((action as { paymentGroupOrigin?: string }).paymentGroupOrigin === "auto_pay_button")
        return null;
      const cards = zoneOf(boardBefore, action.zone);
      const card = cards?.find((candidate) => candidate.id === action.cardId);
      return typeof card?.exhausted === "boolean" ? "card_exhaust" : null;
    }
    case "chain_resolve":
      if (action.to === "trash" || action.to === "banished") return "card_discard";
      if (action.to === "deck_top" || action.to === "deck_bottom") return "card_recycle";
      return action.to ? null : "ui_click";
    default:
      return null;
  }
}

/** Turn-start sound derived from consecutive rooms (`0xawjzm3yjpr1.js:59340`). */
export function deriveTurnStartSound(previous: Room | null, current: Room): SoundKey | null {
  if (
    current.phase === "in_game" &&
    previous &&
    typeof previous.turnNumber === "number" &&
    typeof current.turnNumber === "number" &&
    current.turnNumber > previous.turnNumber
  ) {
    return current.extraTurnResumePlayerId ? "time_warp" : "turn_start";
  }
  return null;
}

/** Baron Pit activation (`baron_nashor`, fire-once per activation). */
export function deriveBaronPitSound(previous: Room | null, current: Room): SoundKey | null {
  const wasActive = previous?.sharedBattlefieldToken?.active === true;
  const isActive = current.sharedBattlefieldToken?.active === true;
  return !wasActive && isActive ? "baron_nashor" : null;
}

/** Helper for tests/UI: is this action type one the original records a score timestamp for? */
export function isScoreActionType(type: string): boolean {
  return SCORE_ACTION_TYPES.has(type);
}

/** Re-export for convenience. */
export type { Zone };
