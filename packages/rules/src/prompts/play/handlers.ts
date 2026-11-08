/**
 * R2-play prompt handlers — 355 choices and 357.2 cost objects of a Pending chain item.
 *
 * The answer was already checked by `promptAnswerVerdict` (offered options, min..max). The
 * handler binds it, clears the prompt it answered, and continues the process of play: the next
 * prompt, or payment + finalization; a play that can no longer be completed is undone (358.5).
 */
import type { ChainItem, Prompt, PromptAnswer, PromptOption } from "@rift/protocol";
import { fail } from "../../types";
import { chosenPromptOption, registerPromptHandler } from "../handlers";
import { PLAY_PROMPT_REASONS } from "./reasons";
import { optionValue } from "../../play/choices";
import { completeCardItem, continuePendingItem, planPendingCard } from "../../play/process";
import { completeActivationItem, planPendingActivation } from "../../play/activation";
import type { RulesStepContext } from "../../types";
import type { Room } from "@rift/protocol";

function selected(prompt: Prompt, answer: PromptAnswer): PromptOption[] {
  const options = prompt.options ?? [];
  if (Array.isArray(answer.optionIds) && answer.optionIds.length > 0) {
    return answer.optionIds
      .map((id) => options.find((option) => option.id === id))
      .filter((option): option is PromptOption => !!option);
  }
  if (Array.isArray(answer.objectIds) && answer.objectIds.length > 0) {
    return answer.objectIds
      .map((id) => options.find((option) => option.objectId === id || option.id === id))
      .filter((option): option is PromptOption => !!option);
  }
  const single = chosenPromptOption(prompt, answer);
  return single ? [single] : [];
}

function pendingItem(room: Room, prompt: Prompt): ChainItem | undefined {
  return room.rules?.chain.find((entry) => entry.id === prompt.sourceItemId && entry.status === "pending" && !!entry.process);
}

function resume(room: Room, step: RulesStepContext, item: ChainItem) {
  if (item.kind === "activated") return continuePendingItem(room, step, item, planPendingActivation, completeActivationItem);
  return continuePendingItem(room, step, item, planPendingCard, completeCardItem);
}

registerPromptHandler(PLAY_PROMPT_REASONS.choice, ({ room, prompt, actorId, answer, step }) => {
  const item = pendingItem(room, prompt);
  if (!item || item.controller !== actorId) return fail("no_pending_prompt", "411.2");
  const key = typeof prompt.data?.key === "string" ? prompt.data.key : undefined;
  if (!key) return fail("invalid_choice", prompt.rule ?? "355");
  const chosen = selected(prompt, answer);
  const max = prompt.max ?? 1;
  const values = chosen.map(optionValue);
  item.choices[key] =
    max <= 1 ? (values[0] ?? null) : values.every((value) => typeof value === "number") ? (values as number[]) : values.map(String);
  // Clear the answered prompt before continuing so the next one (if any) can open.
  if (room.rules?.prompt?.id === prompt.id) room.rules.prompt = null;
  return resume(room, step, item);
});

registerPromptHandler(PLAY_PROMPT_REASONS.cost, ({ room, prompt, actorId, answer, step }) => {
  const item = pendingItem(room, prompt);
  if (!item?.process || item.controller !== actorId) return fail("no_pending_prompt", "411.2");
  const category = prompt.data?.category;
  if (category !== "exhaust" && category !== "kill" && category !== "discard") {
    return fail("invalid_choice", prompt.rule ?? "357.2");
  }
  const ids = selected(prompt, answer).map((option) => option.objectId ?? option.cardId ?? option.id);
  item.process.request.plan = { ...(item.process.request.plan ?? {}), [category]: ids };
  if (room.rules?.prompt?.id === prompt.id) room.rules.prompt = null;
  return resume(room, step, item);
});
