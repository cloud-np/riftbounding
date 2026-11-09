/** `rules_choose` — rule 411.2 Limited-Action prompt answers. */
import type { PromptAnswer, Room, RulesState } from "@rift/protocol";
import type { RulesStepContext } from "../types";
import { fail, pushEvent } from "../types";
import { chooseVerdict } from "../legality/choose";
import {
  getPromptHandler,
  legacyPromptReason,
  promptReason,
} from "../prompts";
import type { IntentContext, IntentResult } from "./context";

function recordPromptAnswer(
  rules: RulesState,
  prompt: { id: string },
  actorId: string,
  answer: PromptAnswer,
  step: RulesStepContext,
): void {
  rules.history.promptAnswers = [
    ...(rules.history.promptAnswers ?? []),
    { promptId: prompt.id, playerId: actorId, answer },
  ];
  // Only clear the prompt being answered: a handler may have opened the next prompt in a
  // Burn Out chain (432.3.a) or another Limited Action window, and that one must stay pending.
  if (rules.prompt?.id === prompt.id) rules.prompt = null;
  pushEvent(step.events, { type: "prompt_answered", playerId: actorId, data: { promptId: prompt.id } });
}

/** Shared by the write path and `explainIllegal` (chooseVerdict). */
export function applyPromptAnswer(
  room: Room,
  actorId: string,
  promptId: string,
  answer: PromptAnswer,
  step: RulesStepContext,
): IntentResult {
  const verdict = chooseVerdict(room, actorId, promptId, answer, step.host);
  if (!verdict.ok) return verdict;
  const rules = room.rules;
  if (!rules) return fail("rules_require_strict", "contract:§1");
  const prompt = verdict.prompt;

  // F13: dispatch on `data.reason`; fall back to today's kind-based behaviour only when the
  // creator did not record a reason (both merge orders keep working).
  const reason = promptReason(prompt) ?? legacyPromptReason(prompt);
  const handler = getPromptHandler(reason);
  if (handler) {
    const handled = handler({ room, prompt, actorId, answer, step });
    if (!handled.ok) return handled;
    recordPromptAnswer(rules, prompt, actorId, answer, step);
    return { ok: true };
  }

  recordPromptAnswer(rules, prompt, actorId, answer, step);

  // R1 fallback: choices for manual/effect prompts are recorded and the window closes.
  // TODO(R2): bind the answer into the item's `choices` / effect selector resolution.
  if (prompt.sourceItemId) {
    const item = rules.chain.find((entry) => entry.id === prompt.sourceItemId);
    if (item) item.choices.promptAnswer = answer as never;
  }
  return { ok: true };
}

export function handleChoose(context: IntentContext): IntentResult {
  const { room, actorId, intent, step } = context;
  if (intent.type !== "rules_choose") return fail("unknown_intent", "contract:§5");
  return applyPromptAnswer(room, actorId, intent.promptId, intent.answer, step);
}
