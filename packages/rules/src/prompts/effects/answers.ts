/** Shared answer normalization for R2-effects prompts (411.2). */
import type { Prompt, PromptAnswer, Room, SelectorGroupRequirement, Verdict } from "@rift/protocol";
import type { RulesHost } from "../../host";
import { fail } from "../../types";
import type { Continuation } from "../../effects/machine";
import { groupSatisfied, isOneOfSubsets } from "../../effects/group";
import { isSplitAsk, splitAnswerVerdict } from "../../effects/split";

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

/**
 * Decision-specific checks of an `effects.resume` answer (beyond 411.2's offered options and
 * count): a split division (355.14.e–g), the number of split targets kept (355.14.h.1), a
 * group subset (355.11.b / 355.11.b.1) and a group requirement on a resolution-time choice
 * (355.11.a). Shared by the resume handler and `chooseVerdict` (explainIllegal).
 */
export function resumeAnswerVerdict(room: Room, host: RulesHost, prompt: Prompt, answer: PromptAnswer): Verdict {
  const data = (prompt.data ?? {}) as Record<string, unknown>;
  const ask = (data.ask ?? {}) as Record<string, unknown>;
  if (isSplitAsk(ask)) return splitAnswerVerdict(ask, answer);
  if (ask.answer !== "objects") return { ok: true };
  const chosen = selectedObjectIds(prompt, selectedOptionIds(prompt, answer));
  if (typeof ask.exact === "number" && chosen.length !== ask.exact) {
    return fail("invalid_choice", "355.14.h.1", `keep exactly ${ask.exact}`);
  }
  if (Array.isArray(ask.subsets) && !isOneOfSubsets(ask.subsets as string[][], chosen)) {
    return fail("invalid_choice", "355.11.b.1", "not a maximal legal subset of the targets");
  }
  const group = ask.group as SelectorGroupRequirement | undefined;
  if (group) {
    const continuation = data.continuation as Continuation | undefined;
    if (continuation?.env && !groupSatisfied({ room, host, env: continuation.env }, group, chosen)) {
      return fail("illegal_target", "355.11.a");
    }
  }
  return { ok: true };
}
