/**
 * `rules_concede` verdict — 650 / 651.3 (R2-int). Shared by the write path and `explainIllegal`.
 *
 * 650: a player may concede at any time, so no Priority/Focus/prompt/timing check applies.
 * 651.3: a player who was already removed from the game can no longer make choices.
 */
import type { Room, Verdict } from "@rift/protocol";
import type { RulesHost } from "../host";
import { fail } from "../types";

export function concedeVerdict(room: Room, playerId: string, host: RulesHost): Verdict {
  if (!host.activePlayerIds(room).includes(playerId)) {
    return fail("illegal_action", "651.3", "player is not in the game");
  }
  return { ok: true };
}
