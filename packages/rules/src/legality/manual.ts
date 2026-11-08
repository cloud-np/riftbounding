/** Manual-window close verdict — §6.4 (contract), 321/321.1. */
import type { Room, Verdict } from "@rift/protocol";
import { fail } from "../types";

const CONTRACT_64 = "contract:§6.4";

/** §6.4: only the manual window's player may close it. */
export function manualDoneVerdict(room: Room, playerId: string): Verdict {
  const rules = room.rules;
  if (!rules) return fail("rules_require_strict", "contract:§1");
  if (!rules.manual) return fail("no_manual_window", CONTRACT_64);
  if (rules.manual.player !== playerId) return fail("not_your_priority", CONTRACT_64);
  return { ok: true };
}
