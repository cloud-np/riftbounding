/**
 * `effects.replacement` — a replacement decision outside an effect resolution (371.2.a, 372,
 * 373): a held death in a cleanup, held combat damage, …
 *
 * `data.queue` holds the held events (373: simultaneous events are treated one at a time); the
 * prompt asks about the first. The answer settles it (the replacement applies, or the original
 * action happens) and the next queued decision is asked; the procedure that was waiting (a
 * queued cleanup, 321) continues once the queue is empty.
 */
import type { HeldReplacement } from "../../replacements/decisions";
import { answerHeld, openReplacementPrompt, resettleHeld } from "../../replacements/interceptor";
import { registerPromptHandler } from "../handlers";
import { selectedOptionIds } from "./answers";
import { EFFECTS_PROMPT_REASONS } from "./reasons";

registerPromptHandler(EFFECTS_PROMPT_REASONS.replacement, ({ room, prompt, answer, step }) => {
  const rules = room.rules;
  if (!rules) return { ok: true };
  const queue = Array.isArray(prompt.data?.queue) ? ([...(prompt.data!.queue as HeldReplacement[])] as HeldReplacement[]) : [];
  const first = queue.shift();
  // The answered prompt closes first: settling may hold further events (a new prompt).
  if (rules.prompt?.id === prompt.id) rules.prompt = null;
  if (!first) return { ok: true };
  const choice = typeof answer.boolean === "boolean" ? answer.boolean : selectedOptionIds(prompt, answer)[0];
  let next = answerHeld(room, step, first, choice);
  const pending: HeldReplacement[] = next ? [next] : [];
  while (!next && queue.length > 0) {
    next = resettleHeld(room, step, queue.shift()!);
    if (next) pending.push(next);
  }
  const later = [...pending, ...queue];
  if (later.length === 0) return { ok: true };
  // Events held while settling (a new replacement prompt) are asked after these.
  const opened = rules.prompt?.data?.reason === EFFECTS_PROMPT_REASONS.replacement && Array.isArray(rules.prompt.data.queue)
    ? (rules.prompt.data.queue as HeldReplacement[])
    : [];
  if (rules.prompt && opened.length === 0) return { ok: true };
  openReplacementPrompt(room, step, [...later, ...opened]);
  return { ok: true };
});
