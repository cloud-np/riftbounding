import { describe, expect, it } from "vitest";

import { gameplayRejectionError, isRulesRejectionError } from "../matchRuntime";

describe("strict rejection errors (R2-int, §5)", () => {
  it("[R312] keeps the ReasonCode, rule and detail of a strict rejection frame", () => {
    const error = gameplayRejectionError("not_your_priority: rule 312", "not_your_priority", {
      rule: "312",
      detail: "p2 has priority",
    });
    expect(isRulesRejectionError(error)).toBe(true);
    expect(error).toMatchObject({
      code: "not_your_priority",
      rule: "312",
      detail: "p2 has priority",
    });
    expect(error.message).toBe("not_your_priority: rule 312");
  });

  it("leaves sandbox rejections as plain errors", () => {
    const error = gameplayRejectionError("Card not found.", "card_not_found", {});
    expect(isRulesRejectionError(error)).toBe(false);
    expect(error.name).toBe("Error");
  });
});
