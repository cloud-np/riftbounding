/**
 * `rules_concede` — 649–652 (R2-int). A player may concede at any time (650). The handler only
 * checks that the player is still in the game (651.3) and calls the existing `concede`
 * (scoring/concede.ts), which decides the winner (651.1 / 195 / 491.6.a) or removes the player
 * (651.2 / 652).
 */
import { fail } from "../types";
import { concedeVerdict } from "../legality/concede";
import { concede } from "../scoring/concede";
import type { IntentContext, IntentResult } from "./context";

export function handleConcede(context: IntentContext): IntentResult {
  const { room, actorId, host, step } = context;
  if (context.intent.type !== "rules_concede") return fail("unknown_intent", "contract:§5");
  const verdict = concedeVerdict(room, actorId, host);
  if (!verdict.ok) return verdict;
  concede(room, actorId, step);
  return { ok: true };
}
