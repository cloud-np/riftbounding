// owner: R2-play; register domain answerers here
import type { Prompt, PromptAnswer } from "@rift/protocol";
import { registerPromptAnswerer } from "./registry";

/** Pick the first `min` (at least one, at most `max`) offered options. */
function firstOptions(prompt: Prompt): PromptAnswer {
  const options = prompt.options ?? [];
  const min = Math.max(0, prompt.min ?? 1);
  const max = Math.max(min, prompt.max ?? options.length);
  const count = Math.min(options.length, Math.max(min, Math.min(1, max)));
  return { optionIds: options.slice(0, count).map((option) => option.id) };
}

// 355 play-time choices (R2-effects choice specs) and 357.2 cost objects (`choose-cost`).
registerPromptAnswerer("play.choice", firstOptions);
registerPromptAnswerer("play.cost", firstOptions);
// 403.1 "you may" / 405.2 pay or decline for a Pending triggered ability: "yes" is offered first.
registerPromptAnswerer("play.trigger", firstOptions);
registerPromptAnswerer("kind:choose-cost", firstOptions);
