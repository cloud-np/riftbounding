/** Pass priority / focus verdict — rules 338.1.b, 347.2. */
import type { Room, Verdict } from "@rift/protocol";
import { fail } from "../types";

const CONTRACT_1 = "contract:§1";
const CONTRACT_64 = "contract:§6.4";

/** 338.1.b / 347.2: pass Priority (Closed) or Focus (Showdown Open). */
export function passVerdict(room: Room, playerId: string): Verdict {
  const rules = room.rules;
  if (!rules) return fail("rules_require_strict", CONTRACT_1);
  if (room.gameOutcome) return fail("game_over", "474");
  if (rules.prompt) return fail("prompt_pending", "411.2");
  if (rules.manual) return fail("manual_window_pending", CONTRACT_64);
  if (!rules.priority && !rules.focus) return fail("nothing_to_pass", "338.1.b");
  if (rules.chain.length > 0) {
    if (rules.priority !== playerId) return fail("not_your_priority", "338.1.b");
    return { ok: true };
  }
  if (rules.showdown) {
    if (rules.focus !== playerId) return fail("not_your_priority", "347.2");
    return { ok: true };
  }
  return fail("nothing_to_pass", "338.1.b");
}
