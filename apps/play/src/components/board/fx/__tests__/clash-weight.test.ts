import { describe, expect, it } from "vitest";

import { CLASH_HITSTOP_MAX, CLASH_IMPACT_AT, clashWeight } from "../effects";
import { rarityGap, rarityHold, rarityRgb } from "../rarity-fx";

describe("clash weight", () => {
  it("scales from light (might 1) to heavy (might 8+), clamped", () => {
    expect(clashWeight(1)).toBe(0);
    expect(clashWeight(8)).toBe(1);
    expect(clashWeight(20)).toBe(1);
    expect(clashWeight(4)).toBeGreaterThan(clashWeight(2));
    expect(clashWeight(undefined)).toBeGreaterThan(0);
  });

  it("keeps the nominal clash timeline under the 2.2s budget", () => {
    expect(CLASH_IMPACT_AT + CLASH_HITSTOP_MAX + 420 + 520).toBeLessThan(2200);
  });
});

describe("rarity fx helpers", () => {
  it("gives legendary more hold and gap than epic, none for common", () => {
    expect(rarityHold("legendary")).toBeGreaterThan(rarityHold("epic"));
    expect(rarityHold("epic")).toBeGreaterThan(rarityHold(null));
    expect(rarityGap("legendary")).toBeGreaterThan(rarityGap("epic"));
    expect(rarityRgb("epic")).not.toBe(rarityRgb("legendary"));
  });
});
