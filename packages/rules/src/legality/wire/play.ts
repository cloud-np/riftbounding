/** `rules_play` payload shape — 349–359 (contract §3). */
import type { RulesFailure } from "../../types";
import { fail } from "../../types";
import { validateChoiceRecord, type WireValidator } from "./shared";

export const validatePlayIntent: WireValidator = (value): RulesFailure | null => {
  if (typeof value.cardId !== "string" || value.cardId.length === 0) {
    return fail("illegal_action", "349", "cardId must be a non-empty string");
  }
  const choices = validateChoiceRecord(value.choices, "choices", "rules_play");
  if (choices) return choices;
  const payment = validateChoiceRecord(value.payment, "payment", "rules_play");
  if (payment) return payment;
  if (value.location !== undefined && typeof value.location !== "string") {
    return fail("illegal_action", "355.2", "location must be a string");
  }
  return null;
};
