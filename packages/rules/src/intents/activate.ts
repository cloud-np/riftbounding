/** `rules_activate` — rules 376–381, 399–407, 430.2. */
import { fail } from "../types";
import { activateIntentVerdict } from "../legality/activate";
import { executeActivation } from "../play/activation";
import { requestFromIntent } from "../play/request";
import type { IntentContext, IntentResult } from "./context";

export function handleActivate(context: IntentContext): IntentResult {
  const { room, actorId, intent, host, step } = context;
  if (intent.type !== "rules_activate") return fail("unknown_intent", "contract:§5");
  // 376–381/403.3 + 355–357: one verdict before any mutation; explainIllegal agrees.
  const verdict = activateIntentVerdict(room, actorId, intent, host);
  if (!verdict.ok) return verdict;
  return executeActivation(room, step, actorId, verdict, requestFromIntent(intent));
}
