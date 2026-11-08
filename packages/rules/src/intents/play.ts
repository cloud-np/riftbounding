/** `rules_play` — rules 349–359 process of play, 420, 422/811.1.b (Hide). */
import { fail } from "../types";
import { playIntentVerdict } from "../legality/play";
import { executeCardPlay } from "../play/process";
import { executeHide } from "../play/hidden";
import { requestFromIntent } from "../play/request";
import type { IntentContext, IntentResult } from "./context";

export function handlePlay(context: IntentContext): IntentResult {
  const { room, actorId, intent, host, step } = context;
  if (intent.type !== "rules_play") return fail("unknown_intent", "contract:§5");
  // One verdict (permission, timing, location, choices, total cost, payment) before any
  // mutation (358.5); `explainIllegal` runs the same function.
  const verdict = playIntentVerdict(room, actorId, intent, host);
  if (!verdict.ok) return verdict;
  if (verdict.kind === "hide") return executeHide(room, step, actorId, verdict.plan);
  return executeCardPlay(room, step, actorId, verdict.plan, requestFromIntent(intent));
}
