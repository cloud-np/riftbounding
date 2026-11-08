/** `rules_move` payload shape — 144, 449–455 (contract §3). */
import type { RulesFailure } from "../../types";
import { fail } from "../../types";
import { isStringArray, type WireValidator } from "./shared";

export const validateMoveIntent: WireValidator = (value): RulesFailure | null => {
  if (!isStringArray(value.unitIds)) {
    return fail("illegal_action", "144", "unitIds must be an array of strings");
  }
  if (typeof value.to !== "string" || value.to.length === 0) {
    return fail("illegal_action", "449.2", "to must be a non-empty string");
  }
  return null;
};
