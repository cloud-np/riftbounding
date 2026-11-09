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
import { continueRepeatResolution } from "../../timing/fepr/resolve";
import { registerPromptHandler } from "../handlers";
import { booleanOf, resumeAnswerVerdict, selectedObjectIds, selectedOptionIds } from "./answers";
import { splitShares } from "../../effects/split";
import { EFFECTS_PROMPT_REASONS } from "./reasons";

registerPromptHandler(EFFECTS_PROMPT_REASONS.resume, ({ room, prompt, answer, step }) => {
  const rules = room.rules;
  if (!rules) return { ok: true };
  const data = (prompt.data ?? {}) as Record<string, unknown>;
  const continuation = data.continuation as Continuation | undefined;
  if (!continuation || !Array.isArray(continuation.stack) || !continuation.env) return { ok: true };
  const ask = (data.ask ?? {}) as { answer?: string; key?: string };
  // 411.2: an answer that breaks the decision's rules is rejected; the prompt stays pending.
  const verdict = resumeAnswerVerdict(room, step.host, prompt, answer);
  if (!verdict.ok) return verdict;
  const selected = selectedOptionIds(prompt, answer);
  let value: unknown;
  switch (ask.answer) {
    case "split":
      value = splitShares(answer);
      break;
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
  // 340 / 359: the chain item that was resolving finishes once its last instruction ran.
  const item = env.itemId ? rules.chain.find((entry) => entry.id === env.itemId) : undefined;
  if (result.status === "done" && item && item.status === "finalized") {
    // 820.1.d.1 / 820.3: this execution finished; run the remaining paid Repeat executions (or
    // finish the resolution when there are none).
    item.repeatExecutionsDone = (item.repeatExecutionsDone ?? 0) + 1;
    continueRepeatResolution(room, item, step);
  }
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
