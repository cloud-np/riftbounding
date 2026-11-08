/**
 * Read-side restore contract — NEW-7.
 *
 * `explainIllegal`/`legalIntents` must reach the same verdict as `applyRulesIntent` for a strict
 * in-game room that lost its `RulesState`. They therefore run the same reconstruct path, but on
 * a clone (views never mutate the caller's room) and without emitting events.
 */
import type { Room } from "@rift/protocol";
import type { RulesHost } from "../host";
import type { RulesFailure } from "../types";
import { fail } from "../types";
import { restoreRulesState } from "../state/create";

export type ReadableRulesRoom = { ok: true; room: Room } | RulesFailure;

/** Strict + in_game + a RulesState (restored on a clone when missing). */
export function readableRulesRoom(room: Room, host: RulesHost): ReadableRulesRoom {
  // Mirror the write path's prologue order (§3): mode before phase before outcome.
  if (room.rulesMode !== "strict") return fail("rules_require_strict", "contract:§1");
  if (room.phase !== "in_game") return fail("not_in_game", "contract:§2");
  if (room.gameOutcome) return fail("game_over", "474");
  if (room.rules) return { ok: true, room };
  const draft = host.cloneRoom(room);
  draft.rules = restoreRulesState(draft, host);
  return { ok: true, room: draft };
}
