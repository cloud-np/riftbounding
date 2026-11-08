import { describe, expect, it } from "vitest";

import { canDropLocally, computeOrderedDropIndex } from "../drop-legality";

const rects = [
  { left: 0, right: 100, top: 0, bottom: 140, width: 100, height: 140 },
  { left: 100, right: 200, top: 0, bottom: 140, width: 100, height: 140 },
  { left: 200, right: 300, top: 0, bottom: 140, width: 100, height: 140 },
];

describe("ordered drop index", () => {
  it("counts midpoints passed (hand fan horizontal)", () => {
    expect(computeOrderedDropIndex(rects, 10, 70)).toBe(0);
    expect(computeOrderedDropIndex(rects, 60, 70)).toBe(1);
    expect(computeOrderedDropIndex(rects, 160, 70)).toBe(2);
    expect(computeOrderedDropIndex(rects, 400, 70)).toBe(3);
  });

  it("clamps to 0..length", () => {
    expect(computeOrderedDropIndex(rects, -100, 70)).toBe(0);
    expect(computeOrderedDropIndex(rects, 9999, 70)).toBe(rects.length);
    expect(computeOrderedDropIndex([], 100, 100)).toBe(0);
  });

  it("uses the y axis for vertical rails", () => {
    const vertical = [
      { left: 0, right: 140, top: 0, bottom: 100, width: 140, height: 100 },
      { left: 0, right: 140, top: 100, bottom: 200, width: 140, height: 100 },
    ];
    expect(computeOrderedDropIndex(vertical, 70, 20, "vertical")).toBe(0);
    expect(computeOrderedDropIndex(vertical, 70, 160, "vertical")).toBe(2);
  });
});

describe("local drop pre-filter", () => {
  it("rejects spells on base/battlefields and runes outside the rune area", () => {
    expect(canDropLocally({ from: "hand", to: "base", type: "Spell" })).toBe(false);
    expect(canDropLocally({ from: "hand", to: "battlefieldA", type: "Spell" })).toBe(false);
    expect(canDropLocally({ from: "runeArea", to: "hand", type: "Rune" })).toBe(false);
    expect(canDropLocally({ from: "runeArea", to: "runeArea", type: "Rune" })).toBe(true);
  });

  it("allows units and gear on the field", () => {
    expect(canDropLocally({ from: "hand", to: "base", type: "Unit" })).toBe(true);
    expect(canDropLocally({ from: "hand", to: "battlefieldB", type: "Unit Gear" })).toBe(true);
  });
});
