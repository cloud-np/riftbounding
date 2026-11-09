/**
 * `effects.resume` — a decision made while a spell or ability resolves (355.18, 411.2).
 *
 * The prompt carries the interpreter continuation (`effects/machine.ts`). The answer is written
 * into the waiting frame (or bound under the asked choice key) and the interpreter continues; a
 * further decision opens the next prompt. An instruction that turns out to be unimplemented
 * opens the §6.4 manual window for the rest of the resolution.
 */
import { pushEvent } from "../../types";
import { runMachine, type Continuation } from "../../effects/machine";
import { registerPromptHandler } from "../handlers";
import { booleanOf, selectedObjectIds, selectedOptionIds } from "./answers";
import { EFFECTS_PROMPT_REASONS } from "./reasons";

registerPromptHandler(EFFECTS_PROMPT_REASONS.resume, ({ room, prompt, answer, step }) => {
  const rules = room.rules;
  if (!rules) return { ok: true };
  const data = (prompt.data ?? {}) as Record<string, unknown>;
  const continuation = data.continuation as Continuation | undefined;
  if (!continuation || !Array.isArray(continuation.stack) || !continuation.env) return { ok: true };
  const ask = (data.ask ?? {}) as { answer?: string; key?: string };
  const selected = selectedOptionIds(prompt, answer);
  let value: unknown;
  switch (ask.answer) {
    case "boolean":
      value = booleanOf(answer, selected);
      break;
    case "objects":
      value = selectedObjectIds(prompt, selected);
      break;
    case "zone":
      value = selectedObjectIds(prompt, selected)[0] ?? null;
      break;
    default:
      value = selected;
  }
  const env = continuation.env;
  if (ask.key) {
    env.vars[ask.key] = value;
    env.vars[`$legal:${ask.key}`] = value;
  } else {
    const top = continuation.stack[continuation.stack.length - 1];
    if (top) top.answer = value;
  }
  // The answered prompt closes before the interpreter continues (it may open the next one).
  if (rules.prompt?.id === prompt.id) rules.prompt = null;
  const result = runMachine(room, step, continuation);
  if (result.status === "manual" && !rules.manual) {
    rules.manual = {
      itemId: env.itemId ?? prompt.id,
      player: env.controller,
      cardName: env.sourceName ?? "Effect",
    };
    rules.priority = null;
    pushEvent(step.events, {
      type: "manual_window",
      playerId: env.controller,
      data: { itemId: env.itemId ?? prompt.id, reason: result.reason },
    });
  }
  return { ok: true };
});
