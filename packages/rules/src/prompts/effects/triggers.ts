/**
 * Trigger prompts — `effects.order_triggers` (383.3.d / 383.3.d.1). The 403.1 / 403.2 / 405.2
 * decisions of a Pending trigger are play prompts (`play.trigger`, `play.choice`).
 */
import { flushInOrder, placeOrdered } from "../../triggers";
import { registerPromptHandler } from "../handlers";
import { selectedOptionIds } from "./answers";
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
