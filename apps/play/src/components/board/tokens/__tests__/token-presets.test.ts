import { describe, expect, it } from "vitest";

import {
  BASE_TOKEN_PRESETS,
  BATTLEFIELD_TOKEN_PRESETS,
  DEFAULT_TOKEN_PRESETS,
  filterTokenPresets,
  tokenPresetsForZone,
} from "../token-presets";

describe("token presets", () => {
  it("keeps the original default list order", () => {
    expect(DEFAULT_TOKEN_PRESETS.map((preset) => preset.name)).toEqual([
      "Recruit",
      "Gold",
      "Mech",
      "Sand Soldier",
      "Sprite",
      "Bird",
      "Reflection",
      "Shadow Clone",
      "Tentacle",
    ]);
  });

  it("puts Gold first in base", () => {
    expect(BASE_TOKEN_PRESETS[0]?.name).toBe("Gold");
    expect(tokenPresetsForZone("base")[0]?.name).toBe("Gold");
  });

  it("battlefields drop Gold and append Bomb", () => {
    expect(BATTLEFIELD_TOKEN_PRESETS.some((preset) => preset.name === "Gold")).toBe(false);
    expect(BATTLEFIELD_TOKEN_PRESETS.at(-1)?.name).toBe("Bomb");
    expect(tokenPresetsForZone("battlefieldB").at(-1)?.name).toBe("Bomb");
  });

  it("filters token names case-insensitively", () => {
    expect(filterTokenPresets(DEFAULT_TOKEN_PRESETS, "mech").map((preset) => preset.name)).toEqual(["Mech"]);
    expect(filterTokenPresets(DEFAULT_TOKEN_PRESETS, "  ").length).toBe(DEFAULT_TOKEN_PRESETS.length);
  });
});
