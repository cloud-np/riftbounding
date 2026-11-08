import { describe, expect, it } from "vitest";

import {
  CARD_SIZE_DEFAULT,
  OPPONENT_COSMETICS_DEFAULT,
  PREVIEW_SIZE_DEFAULT,
  snapCardSize,
  snapOpponentCosmetics,
  snapPreviewSize,
} from "../settings-values";

describe("snapCardSize", () => {
  it("defaults non-finite values to 100", () => {
    expect(snapCardSize(Number.NaN)).toBe(CARD_SIZE_DEFAULT);
    expect(snapPreviewSize(Number.POSITIVE_INFINITY)).toBe(PREVIEW_SIZE_DEFAULT);
    expect(snapOpponentCosmetics(Number.NaN)).toBe(OPPONENT_COSMETICS_DEFAULT);
  });

  it("clamps and snaps card size to 50..150 / 5", () => {
    expect(snapCardSize(0)).toBe(50);
    expect(snapCardSize(200)).toBe(150);
    expect(snapCardSize(101)).toBe(100);
    expect(snapCardSize(103)).toBe(105);
    expect(snapCardSize(147)).toBe(145);
  });

  it("clamps and snaps preview size to 50..150 / 5", () => {
    expect(snapPreviewSize(49)).toBe(50);
    expect(snapPreviewSize(149.9)).toBe(150);
    expect(snapPreviewSize(88)).toBe(90);
  });

  it("clamps and snaps opponent cosmetics to 25..100 / 5", () => {
    expect(snapOpponentCosmetics(0)).toBe(25);
    expect(snapOpponentCosmetics(24)).toBe(25);
    expect(snapOpponentCosmetics(1000)).toBe(100);
    expect(snapOpponentCosmetics(63)).toBe(65);
  });
});
