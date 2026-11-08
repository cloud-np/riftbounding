/** `rules_choose` payload shape — 411.2 (contract §3). */
import type { RulesFailure } from "../../types";
import { fail } from "../../types";
import { isRecord, isStringArray, type WireValidator } from "./shared";

export const validateChooseIntent: WireValidator = (value): RulesFailure | null => {
  if (typeof value.promptId !== "string" || value.promptId.length === 0) {
    return fail("illegal_action", "411.2", "promptId must be a non-empty string");
  }
  const answer = value.answer;
  if (!isRecord(answer)) {
    return fail("illegal_action", "411.2", "answer must be an object");
  }
  for (const field of ["optionIds", "cardIds", "objectIds", "order"] as const) {
    if (answer[field] !== undefined && !isStringArray(answer[field])) {
      return fail("illegal_action", "411.2", `answer.${field} must be an array of strings`);
    }
  }
  for (const field of ["playerId", "zone"] as const) {
    if (answer[field] !== undefined && typeof answer[field] !== "string") {
      return fail("illegal_action", "411.2", `answer.${field} must be a string`);
    }
  }
  if (answer.number !== undefined && typeof answer.number !== "number") {
    return fail("illegal_action", "411.2", "answer.number must be a number");
  }
  return null;
};
