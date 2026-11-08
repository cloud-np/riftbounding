/** `rules_pass` — rules 338.1.b (priority) / 347.2 (focus). */
import { fail } from "../types";
import { passVerdict } from "../legality/pass";
import { passPriority, runCleanupOrQueue } from "../timing/fepr";
import { passFocus } from "../timing/showdown";
import type { IntentContext, IntentResult } from "./context";

export function handlePass(context: IntentContext): IntentResult {
  const { room, rules, actorId, step } = context;
  if (context.intent.type !== "rules_pass") return fail("unknown_intent", "contract:§5");
  const verdict = passVerdict(room, actorId);
  if (!verdict.ok) return verdict;
  if (rules.chain.length > 0) {
    passPriority(room, actorId, step);
  } else if (rules.showdown) {
    passFocus(room, actorId, step);
  }
  // 321/321.1: when the pass starts a resolution (manual window/prompt), defer the cleanup.
  runCleanupOrQueue(room, step);
  return { ok: true };
}
