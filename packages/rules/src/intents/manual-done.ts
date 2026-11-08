/** `rules_manual_done` — §6.4 manual window close. */
import { fail } from "../types";
import { manualDoneVerdict } from "../legality/manual";
import { completeManual, runCleanupOrQueue } from "../timing/fepr";
import type { IntentContext, IntentResult } from "./context";

export function handleManualDone(context: IntentContext): IntentResult {
  const { room, actorId, step } = context;
  if (context.intent.type !== "rules_manual_done") return fail("unknown_intent", "contract:§5");
  const verdict = manualDoneVerdict(room, actorId);
  if (!verdict.ok) return verdict;
  const done = completeManual(room, actorId, step);
  if (!done) return fail("no_manual_window", "contract:§6.4");
  // 321/321.1: the deferred cleanup now runs because the resolution is complete.
  runCleanupOrQueue(room, step);
  return { ok: true };
}
