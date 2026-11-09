/**
 * Prompt-handler registry — 411.2 Limited Actions.
 *
 * Answers dispatch on `prompt.data.reason`, never on the UI kind alone: effect prompts reuse
 * `choose-opponent`/`choose-battlefield`, so kind-based dispatch would silently award a Burn Out
 * point or start a showdown. Handlers register themselves from `src/prompts/<reason>.ts`; the
 * package entry imports `src/prompts/index.ts`, so registration happens at import time:
 *
 *   registerPromptHandler("draw_cards", ({ room, prompt, answer, step }) => …)
 *
 * Missing `reason` falls back to R1 behaviour (see `legacyPromptReason`), so prompt creators
 * that predate this registry keep working in either merge order.
 *
 * Registry exemption (contract §1): this is a module-level table of functions filled at import
 * time. It holds no game state; the room is always the argument.
 */
import type { Prompt, PromptAnswer, PromptOption, Room } from "@rift/protocol";
import type { RulesFailure, RulesStepContext } from "../types";
import { fail } from "../types";
import { PROMPT_REASONS } from "./reasons";
import { keyedRegistry } from "../registry-table";

export { PROMPT_REASONS } from "./reasons";
export type { PromptReason } from "./reasons";

export interface PromptHandlerContext {
  room: Room;
  prompt: Prompt;
  actorId: string;
  answer: PromptAnswer;
  step: RulesStepContext;
}

export type PromptHandlerResult = { ok: true } | RulesFailure;
export type PromptHandler = (context: PromptHandlerContext) => PromptHandlerResult;

/** G1: one handler per prompt reason; a second registration throws (tests: `src/testing.ts`). */
export const PROMPT_HANDLERS = keyedRegistry<PromptHandler>("prompt handler");

export function registerPromptHandler(reason: string, handler: PromptHandler): void {
  PROMPT_HANDLERS.register(reason, handler);
}

export function getPromptHandler(reason: string | undefined): PromptHandler | undefined {
  return PROMPT_HANDLERS.get(reason);
}

export function promptHandlerReasons(): string[] {
  return PROMPT_HANDLERS.keys();
}

/** R1 prompts stored `data.reason`; anything else is a legacy/kind-only prompt. */
export function promptReason(prompt: Prompt): string | undefined {
  const data = prompt.data;
  if (!data || typeof data !== "object") return undefined;
  const reason = (data as Record<string, unknown>).reason;
  return typeof reason === "string" ? reason : undefined;
}

/** Today's behaviour for prompts created before the registry existed. */
export function legacyPromptReason(prompt: Prompt): string | undefined {
  if (promptReason(prompt)) return undefined;
  if (prompt.kind === "choose-opponent") return PROMPT_REASONS.burnOut;
  if (prompt.kind === "choose-battlefield") return PROMPT_REASONS.stageShowdown;
  return undefined;
}

/** The option a `PromptAnswer` points at (optionIds, playerId, zone or raw value). */
export function chosenPromptOption(prompt: Prompt, answer: PromptAnswer): PromptOption | undefined {
  const options = prompt.options ?? [];
  const optionIds = Array.isArray(answer.optionIds) ? answer.optionIds : [];
  for (const id of optionIds) {
    const match = options.find((option) => option.id === id);
    if (match) return match;
  }
  if (typeof answer.playerId === "string") {
    const match = options.find((option) => option.playerId === answer.playerId);
    if (match) return match;
  }
  if (typeof answer.zone === "string") {
    const match = options.find((option) => option.zone === answer.zone || option.id === answer.zone);
    if (match) return match;
  }
  if (typeof answer.value === "string") {
    const match = options.find((option) => option.id === answer.value);
    if (match) return match;
  }
  return undefined;
}

/**
 * 411.2: an answer must reference offered options only, and the number of chosen options must
 * satisfy `prompt.min`/`prompt.max` (NEW-11). Shared by `rules_choose`'s write path and
 * `explainIllegal`.
 */
export function promptAnswerVerdict(prompt: Prompt, answer: PromptAnswer): { ok: true } | RulesFailure {
  const options = prompt.options ?? [];
  if (options.length === 0) return { ok: true };
  const selected = selectedPromptOptions(prompt, answer);
  if (!selected.ok) return selected;
  const min = Math.max(0, Math.trunc(prompt.min ?? 1));
  const max = Math.max(min, Math.trunc(prompt.max ?? options.length));
  if (selected.options.length < min || selected.options.length > max) {
    return fail("invalid_choice", prompt.rule ?? "411.2");
  }
  return { ok: true };
}

type SelectedPromptOptions = { ok: true; options: PromptOption[] } | RulesFailure;

/**
 * Resolve every option the answer points at. `optionIds` must all be offered; `playerId`/`zone`/
 * `value` are single-choice fallbacks that only match an offered option (411.2).
 */
function selectedPromptOptions(prompt: Prompt, answer: PromptAnswer): SelectedPromptOptions {
  const options = prompt.options ?? [];
  const byId = new Map(options.map((option) => [option.id, option]));
  const selected: PromptOption[] = [];
  const seen = new Set<string>();
  const add = (option: PromptOption) => {
    if (seen.has(option.id)) return;
    seen.add(option.id);
    selected.push(option);
  };
  const optionIds = Array.isArray(answer.optionIds) ? answer.optionIds : [];
  if (optionIds.length > 0) {
    for (const id of optionIds) {
      const option = byId.get(id);
      if (!option) return fail("invalid_choice", prompt.rule ?? "411.2", `option ${id} was not offered`);
      add(option);
    }
    return { ok: true, options: selected };
  }
  if (typeof answer.playerId === "string") {
    for (const option of options) if (option.playerId === answer.playerId) add(option);
  } else if (typeof answer.zone === "string") {
    for (const option of options) {
      if (option.zone === answer.zone || option.id === answer.zone) add(option);
    }
  } else if (typeof answer.value === "string") {
    const option = byId.get(answer.value);
    if (option) add(option);
  }
  return { ok: true, options: selected };
}
