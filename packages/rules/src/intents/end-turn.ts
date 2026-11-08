/** `rules_end_turn` — rule 316.9. */
import { fail, pushEvent } from "../types";
import { endTurnVerdict } from "../legality/end-turn";
import { clearPasses, setPhase } from "../state";
import type { IntentContext, IntentResult } from "./context";

export function handleEndTurn(context: IntentContext): IntentResult {
  const { room, rules, actorId, step } = context;
  if (context.intent.type !== "rules_end_turn") return fail("unknown_intent", "contract:§5");
  const verdict = endTurnVerdict(room, actorId);
  if (!verdict.ok) return verdict;
  setPhase(rules, "ending", "ending");
  rules.priority = null;
  rules.focus = null;
  clearPasses(rules);
  pushEvent(step.events, { type: "end_turn", playerId: actorId });
  return { ok: true };
}
