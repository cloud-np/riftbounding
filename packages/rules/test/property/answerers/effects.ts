// owner: R2-effects; register domain answerers here
import type { Prompt, PromptAnswer } from "@rift/protocol";
import { registerPromptAnswerer } from "./registry";

/** Pick the first legal number of options (at least one when any may be chosen). */
function firstOptions(prompt: Prompt): PromptAnswer {
  const options = prompt.options ?? [];
  const max = Math.min(prompt.max ?? options.length, options.length);
  const count = Math.max(0, Math.min(max, Math.max(prompt.min ?? 1, 1)));
  return { optionIds: options.slice(0, count).map((option) => option.id) };
}

/** 355.18 resolution choices, 403.1/403.2 trigger choices: first options ("yes" for may). */
registerPromptAnswerer("effects.resume", (prompt) => firstOptions(prompt));
registerPromptAnswerer("effects.trigger_choice", (prompt) => firstOptions(prompt));

/** 383.3.d: place the triggers in the offered order. */
registerPromptAnswerer("effects.order_triggers", (prompt) => ({
  orderedIds: (prompt.options ?? []).map((option) => option.id),
}));
