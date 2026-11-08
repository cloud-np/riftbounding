/** End-turn verdict — rule 316.9. */
import type { Room, Verdict } from "@rift/protocol";
import { fail } from "../types";
import { isTurnPlayer, showdownActive } from "../state/turn";

const CONTRACT_1 = "contract:§1";
const CONTRACT_64 = "contract:§6.4";

/** 316.9: the Turn Player ends the Main Phase only when nothing else is pending. */
export function endTurnVerdict(room: Room, playerId: string): Verdict {
  const rules = room.rules;
  if (!rules) return fail("rules_require_strict", CONTRACT_1);
  if (room.gameOutcome) return fail("game_over", "474");
  if (rules.prompt) return fail("prompt_pending", "411.2");
  if (rules.manual) return fail("manual_window_pending", CONTRACT_64);
  if (!isTurnPlayer(room, playerId)) return fail("not_your_turn", "316.9");
  if (rules.turn.phase !== "main") return fail("not_main_phase", "316.9");
  if (rules.priority !== playerId) return fail("not_your_priority", "312.1");
  if (rules.tasks.length > 0) return fail("chain_not_empty", "316.9");
  if (rules.chain.length > 0) return fail("chain_not_empty", "316.9");
  if (showdownActive(room)) return fail("showdown_active", "316.9");
  return { ok: true };
}
