/** Shared answer normalization for R2-effects prompts (411.2). */
import type { Prompt, PromptAnswer } from "@rift/protocol";

/** Offered option ids an answer selects (optionIds, then the single-value fallbacks). */
export function selectedOptionIds(prompt: Prompt, answer: PromptAnswer): string[] {
  const offered = new Set((prompt.options ?? []).map((option) => option.id));
  const keep = (ids: readonly unknown[]) =>
    ids.filter((id): id is string => typeof id === "string" && (offered.size === 0 || offered.has(id)));
  if (Array.isArray(answer.optionIds) && answer.optionIds.length > 0) return keep(answer.optionIds);
  if (Array.isArray(answer.orderedIds) && answer.orderedIds.length > 0) return keep(answer.orderedIds);
  if (Array.isArray(answer.objectIds) && answer.objectIds.length > 0) return keep(answer.objectIds);
  if (Array.isArray(answer.cardIds) && answer.cardIds.length > 0) return keep(answer.cardIds);
  if (typeof answer.value === "string") return keep([answer.value]);
  if (typeof answer.zone === "string") return keep([answer.zone]);
  if (typeof answer.playerId === "string") return keep([answer.playerId]);
  if (typeof answer.boolean === "boolean") return keep([answer.boolean ? "yes" : "no"]);
  if (typeof answer.number === "number") return keep([String(answer.number)]);
  return [];
}

/** Map selected option ids to the object ids they stand for. */
export function selectedObjectIds(prompt: Prompt, ids: readonly string[]): string[] {
  return ids.map((id) => {
    const option = prompt.options?.find((entry) => entry.id === id);
    return option?.objectId ?? option?.cardId ?? option?.zone ?? option?.playerId ?? id;
  });
}

export function booleanOf(answer: PromptAnswer, selected: readonly string[]): boolean {
  if (typeof answer.boolean === "boolean") return answer.boolean;
  return selected.includes("yes");
}
