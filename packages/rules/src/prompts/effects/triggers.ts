/**
 * Trigger prompts — `effects.order_triggers` (383.3.d / 383.3.d.1) and
 * `effects.trigger_choice` (403.1 / 403.2).
 */
import { flushInOrder, placeOrdered } from "../../triggers";
import { answerTriggerChoice } from "../../triggers/finalize";
import { registerPromptHandler } from "../handlers";
import { booleanOf, selectedObjectIds, selectedOptionIds } from "./answers";
import { EFFECTS_PROMPT_REASONS } from "./reasons";

/**
 * 383.3.d: the controller lists their simultaneous triggers in the order they are placed on the
 * chain (first placed resolves last); unlisted ones follow in detection order. The remaining
 * players then place theirs in the same player order.
 */
registerPromptHandler(EFFECTS_PROMPT_REASONS.orderTriggers, ({ room, prompt, answer, step }) => {
  const rules = room.rules;
  if (!rules) return { ok: true };
  const ordered = Array.isArray(answer.orderedIds) && answer.orderedIds.length > 0
    ? answer.orderedIds.filter((id): id is string => typeof id === "string")
    : selectedOptionIds(prompt, answer);
  if (rules.prompt?.id === prompt.id) rules.prompt = null;
  placeOrdered(room, step, prompt.playerId, ordered);
  const order = Array.isArray(prompt.data?.order) ? (prompt.data.order as string[]) : [];
  flushInOrder(room, step, order);
  return { ok: true };
});

registerPromptHandler(EFFECTS_PROMPT_REASONS.triggerChoice, ({ room, prompt, answer, step }) => {
  const rules = room.rules;
  if (!rules) return { ok: true };
  const selected = selectedOptionIds(prompt, answer);
  const data = (prompt.data ?? {}) as Record<string, unknown>;
  if (rules.prompt?.id === prompt.id) rules.prompt = null;
  const yesNo = data.stage === "may" || data.stage === "cost";
  answerTriggerChoice(
    room,
    step,
    data,
    yesNo ? selected : selectedObjectIds(prompt, selected),
    yesNo ? booleanOf(answer, selected) : undefined,
  );
  return { ok: true };
});
