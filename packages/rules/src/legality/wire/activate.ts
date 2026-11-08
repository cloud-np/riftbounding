/** `rules_activate` payload shape — 376–381, 399+ (contract §3). */
import type { RulesFailure } from "../../types";
import { fail } from "../../types";
import { validateChoiceRecord, type WireValidator } from "./shared";

export const validateActivateIntent: WireValidator = (value): RulesFailure | null => {
  if (typeof value.objectId !== "string" || value.objectId.length === 0) {
    return fail("illegal_action", "399", "objectId must be a non-empty string");
  }
  if (value.ability !== undefined && typeof value.ability !== "string") {
    return fail("illegal_action", "399", "ability must be a string");
  }
  const choices = validateChoiceRecord(value.choices, "choices", "rules_activate");
  if (choices) return choices;
  const payment = validateChoiceRecord(value.payment, "payment", "rules_activate");
  if (payment) return payment;
  return null;
};
