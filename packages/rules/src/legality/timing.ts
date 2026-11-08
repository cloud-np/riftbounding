/**
 * Shared timing legality — rules 307–313, 380–381, 403.3, 410, 806, 813.
 *
 * The turn is always Neutral/Showdown × Open/Closed (310). Only cards/abilities with Reaction
 * may be played in a Closed State (309.1.a); only Action/Reaction in a Showdown State
 * (308.1.a); by default only the Turn Player with Priority may act in Neutral Open
 * (310.1.a / 410).
 *
 * NEW-3 (R1 re-review): 344 has no Main-only restriction. A Showdown can begin in any phase
 * (notably during an Ending-Phase Cleanup, 806.1.b / 813.1.c.1), so the Main-Phase requirement
 * applies **only** to the default Neutral Open path. Showdown states use the keyword, Focus and
 * Priority checks (347.1) instead.
 *
 * Per-intent verdicts live next to this file (`play.ts`, `activate.ts`, `move.ts`, `pass.ts`,
 * `end-turn.ts`, `choose.ts`, `manual.ts`). They all use the helpers below, so the UI and the
 * server share one timing path.
 */
import type { Room, Verdict } from "@rift/protocol";
import type { CardInfo, RulesHost } from "../host";
import type { RulesFailure } from "../types";
import { fail } from "../types";
import { effectiveKeywords } from "../layers";
import { isTurnPlayer, turnState } from "../state/turn";
import { printedCardKeywords } from "../play/keywords";

/** Contract citations use the documented `contract:§n` form (design contract, not the rulebook). */
const CONTRACT_1 = "contract:§1";
const CONTRACT_2 = "contract:§2";
const CONTRACT_64 = "contract:§6.4";

/**
 * 107: the Board is Bases, Battlefield Zones, Facedown Zones and Legend Zones. Runes remain on
 * the board (133.5.a.1). 056.1: Hand, Deck, Trash, Champion Zone and Banishment are non-board.
 */
export function boardZones(room: Room, host: RulesHost): string[] {
  return ["base", ...host.battlefieldZones(room), "legend", "runeArea"];
}

/** 806/813: Action ⊆ Reaction permissions; both are permissive keywords. */
export function keywordTimingVerdict(room: Room, playerId: string, keywords: string[]): Verdict {
  const state = turnState(room);
  const rules = room.rules;
  if (!rules) return fail("rules_require_strict", CONTRACT_1);
  const isReaction = keywords.some((keyword) => keyword.toLowerCase() === "reaction");
  const isAction = keywords.some((keyword) => keyword.toLowerCase() === "action");

  if (state === "neutral_closed") {
    // 309.1.a: only Reaction in a Closed State (any phase).
    if (!isReaction) return fail("closed_state_requires_reaction", "309.1.a");
    return { ok: true };
  }
  if (state === "showdown_closed") {
    if (!isReaction) return fail("closed_state_requires_reaction", "309.1.a");
    return { ok: true };
  }
  if (state === "showdown_open") {
    // 308.1.a / 313.1.a: only Action or Reaction in a Showdown State.
    if (!isAction && !isReaction) return fail("showdown_requires_action", "308.1.a");
    // 347.1: the player with Focus may play; 313.2 Focus also grants Priority.
    if (rules.focus !== playerId && rules.priority !== playerId) {
      return fail("not_your_priority", "347.1");
    }
    return { ok: true };
  }
  // 310.1.a / 410: Neutral Open — default permission is the Turn Player with Priority.
  if (!isTurnPlayer(room, playerId)) return fail("not_your_turn", "410");
  return { ok: true };
}

/** Common checks before evaluating a card/ability's permission. */
export function baseActionVerdict(room: Room, playerId: string): Verdict {
  const rules = room.rules;
  if (!rules) return fail("rules_require_strict", CONTRACT_1);
  if (room.gameOutcome) return fail("game_over", "474");
  if (rules.prompt) return fail("prompt_pending", "411.2");
  if (rules.manual) return fail("manual_window_pending", CONTRACT_64);
  if (room.phase !== "in_game") return fail("not_in_game", CONTRACT_2);
  // 310.1.a is the only Main-Phase gate (NEW-3): 344 allows a Showdown in any phase, and the
  // Showdown/Closed branches above/below are phase-independent (309.1.a).
  if (turnState(room) === "neutral_open" && rules.turn.phase !== "main") {
    return fail("not_main_phase", "316");
  }
  if (rules.priority !== playerId) return fail("not_your_priority", "312.1");
  return { ok: true };
}

/** Can this player play this card right now (timing only — costs/targets are R2)? */
export function cardTimingVerdict(room: Room, playerId: string, info: CardInfo | null): Verdict {
  const base = baseActionVerdict(room, playerId);
  if (!base.ok) return base;
  if (!info) return fail("unknown_card", CONTRACT_1);
  // 475–479: timing reads granted keywords through the layers module as well as printed ones.
  // 135.2.d.3/135.2.e.7: printed card-level keywords come from the rules text (reminder text and
  // ability-level `[Reaction][>]` are not card permissions), see `play/keywords.ts`.
  const printed = printedCardKeywords(info);
  const keywords = info.objectId ? effectiveKeywords(room, info.objectId, printed) : printed;
  return keywordTimingVerdict(room, playerId, keywords);
}

/** 399+: activated abilities follow the same timing permissions as their keywords. */
export function abilityTimingVerdict(room: Room, playerId: string, keywords: string[]): Verdict {
  const base = baseActionVerdict(room, playerId);
  if (!base.ok) return base;
  return keywordTimingVerdict(room, playerId, keywords);
}

export type { RulesFailure };
