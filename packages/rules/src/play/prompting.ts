/**
 * Play prompts — rule 411.2 (a Limited choice is prompted only when a real choice remains).
 *
 * A Pending chain item (354.2) waits on exactly one prompt at a time: a 355 choice spec from
 * R2-effects (`play.choice`) or the objects paying a non-standard cost (`play.cost`,
 * `choose-cost`). The item's `process` records what the prompt answers.
 */
import type { ChainItem, Room } from "@rift/protocol";
import type { RulesStepContext } from "../types";
import { pushEvent } from "../types";
import type { ChoiceSpec } from "../effects/choices";
import { PLAY_PROMPT_REASONS } from "../prompts/play/reasons";
import type { CostObjectChoice } from "./cost-objects";

export function openChoicePrompt(room: Room, step: RulesStepContext, item: ChainItem, spec: ChoiceSpec): void {
  const rules = room.rules;
  if (!rules) return;
  rules.prompt = {
    id: step.host.nextId("prompt"),
    kind: spec.kind,
    playerId: item.controller,
    ...(spec.label ? { promptKey: spec.label } : {}),
    rule: spec.rule,
    sourceItemId: item.id,
    options: spec.options.map((option) => ({ ...option })),
    min: spec.min,
    // "Up to N" with fewer legal options offers what exists; the bound shape follows `choiceMax`.
    max: Math.max(spec.min, Math.min(spec.max, spec.options.length)),
    data: {
      reason: PLAY_PROMPT_REASONS.choice,
      key: spec.key,
      targeted: spec.targeted,
      choiceMax: spec.max,
      ...(spec.data ? { spec: spec.data } : {}),
    },
  };
  if (item.process) item.process.awaiting = spec.key;
  pushEvent(step.events, { type: "prompt", playerId: item.controller, data: { kind: spec.kind, itemId: item.id, key: spec.key } });
}

export function openCostPrompt(room: Room, step: RulesStepContext, item: ChainItem, choice: CostObjectChoice): void {
  const rules = room.rules;
  if (!rules) return;
  rules.prompt = {
    id: step.host.nextId("prompt"),
    kind: "choose-cost",
    playerId: item.controller,
    promptKey: `rules.prompt.cost.${choice.category}`,
    rule: choice.rule,
    sourceItemId: item.id,
    options: choice.candidates.map((id) => ({ id, cardId: id, objectId: id })),
    min: choice.count,
    max: choice.count,
    data: { reason: PLAY_PROMPT_REASONS.cost, category: choice.category },
  };
  if (item.process) item.process.awaiting = `cost:${choice.category}`;
  pushEvent(step.events, { type: "prompt", playerId: item.controller, data: { kind: "choose-cost", itemId: item.id, category: choice.category } });
}
