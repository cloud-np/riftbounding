/**
 * "Yes to all" — remembered answers for repeated identical prompts (`docs/rules/auto-pass.md`).
 *
 * Only prompts whose answer means the same thing every time are eligible: yes/no decisions
 * (a "you may" trigger, an optional cost, an optional replacement, a resolution-time "may") and
 * trigger ordering (replayed as the default detection order, since trigger ids differ). The
 * signature names the decision and its source, never a card id, so two copies of the same
 * trigger share it while a different card's prompt does not.
 */
import type { Prompt, PromptAnswer, Room } from "@rift/protocol";
import { promptReason } from "../prompts/handlers";
import { EFFECTS_PROMPT_REASONS } from "../prompts/effects/reasons";

export function standingEligible(prompt: Prompt): boolean {
  if (prompt.kind === "order" || promptReason(prompt) === EFFECTS_PROMPT_REASONS.orderTriggers) return true;
  if (prompt.kind !== "yes-no") return false;
  const ids = (prompt.options ?? []).map((option) => option.id).sort();
  return ids.length === 2 && ids[0] === "no" && ids[1] === "yes";
}

function sourceName(room: Room, prompt: Prompt): string {
  const item = prompt.sourceItemId ? room.rules?.chain.find((entry) => entry.id === prompt.sourceItemId) : undefined;
  const data = (prompt.data ?? {}) as Record<string, unknown>;
  const parts = [
    item?.cardName ?? "",
    item?.abilityRef ?? "",
    typeof data.optionalCostId === "string" ? data.optionalCostId : "",
    typeof data.cardName === "string" ? data.cardName : "",
  ];
  return parts.join("/");
}

/** Stable signature of a prompt's decision (`reason|promptKey|kind|source|options`). */
export function promptSignature(room: Room, prompt: Prompt): string {
  const reason = promptReason(prompt) ?? "";
  if (prompt.kind === "order" || reason === EFFECTS_PROMPT_REASONS.orderTriggers) {
    const labels = (prompt.options ?? []).map((option) => option.label ?? "").sort();
    return [reason, prompt.promptKey ?? "", prompt.kind, labels.join(",")].join("|");
  }
  const options = (prompt.options ?? []).map((option) => option.id).sort();
  return [reason, prompt.promptKey ?? "", prompt.kind, sourceName(room, prompt), options.join(",")].join("|");
}

/** The answer stored for later identical prompts (order prompts replay the default order). */
export function standingAnswerFor(prompt: Prompt, answer: PromptAnswer): { optionIds: string[] } | null {
  if (!standingEligible(prompt)) return null;
  if (prompt.kind === "order" || promptReason(prompt) === EFFECTS_PROMPT_REASONS.orderTriggers) return { optionIds: [] };
  const offered = new Set((prompt.options ?? []).map((option) => option.id));
  const ids = Array.isArray(answer.optionIds) ? answer.optionIds.filter((id) => offered.has(id)) : [];
  if (ids.length === 1) return { optionIds: ids };
  if (typeof answer.boolean === "boolean") return { optionIds: [answer.boolean ? "yes" : "no"] };
  return null;
}
