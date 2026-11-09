/**
 * `rules_set_auto_pass` — the actor's auto-pass preferences (`docs/rules/auto-pass.md`).
 *
 * Like `rules_concede` (650) it needs no Priority/Focus/prompt: a preference is not a game
 * action. It only ever changes the actor's own entry; the automatic actions it enables run in
 * `advanceWithAuto` right after (e.g. "pass until end of turn" while holding Priority passes now).
 */
import { fail, pushEvent } from "../types";
import { applyAutoPassUpdate } from "../auto/prefs";
import type { IntentContext, IntentResult } from "./context";

export function handleSetAutoPass(context: IntentContext): IntentResult {
  const { room, rules, actorId, intent, step } = context;
  if (intent.type !== "rules_set_auto_pass") return fail("unknown_intent", "contract:§5");
  if (!step.host.activePlayerIds(room).includes(actorId)) {
    return fail("illegal_action", "651.3", "player is not in the game");
  }
  const prefs = applyAutoPassUpdate(rules, actorId, intent.prefs);
  pushEvent(step.events, { type: "auto_pass_prefs", playerId: actorId, data: { ...prefs } as Record<string, unknown> });
  return { ok: true };
}
