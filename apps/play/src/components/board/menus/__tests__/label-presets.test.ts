import { describe, expect, it } from "vitest";

import {
  adjustLabelCount,
  CUSTOM_LABEL_HOTKEY,
  labelColors,
  labelHotkeyCode,
  LABEL_PRESETS,
  normalizeCardLabel,
} from "../label-presets";

describe("label presets", () => {
  it("has the exact 11 preset hotkeys", () => {
    expect(LABEL_PRESETS.map((preset) => preset.hotkey)).toEqual([
      "1",
      "2",
      "3",
      "4",
      "5",
      "6",
      "7",
      "8",
      "9",
      "0",
      "-",
    ]);
    expect(CUSTOM_LABEL_HOTKEY).toBe("=");
  });

  it("maps hotkeys to KeyboardEvent.code", () => {
    expect(labelHotkeyCode("1")).toBe("Digit1");
    expect(labelHotkeyCode("0")).toBe("Digit0");
    expect(labelHotkeyCode("-")).toBe("Minus");
    expect(labelHotkeyCode("=")).toBe("Equal");
  });

  it("returns the preset colours and the original fallback", () => {
    expect(labelColors("Shield").accentColor).toBe("#d4c1ff");
    expect(labelColors("custom thing")).toEqual({
      accentColor: "#7fd8ff",
      backgroundColor: "rgba(28,58,78,0.95)",
      borderColor: "rgba(116,197,227,0.56)",
      textColor: "#e5f8ff",
    });
  });

  it("adjusts trailing counts like Shield 2 → Shield 3", () => {
    expect(adjustLabelCount("Shield 2", 1)).toBe("Shield 3");
    expect(adjustLabelCount("Shield 1", -1)).toBe("Shield");
    expect(adjustLabelCount("Buff", 1)).toBe("Buff 1");
    expect(adjustLabelCount("Buff 1", -1)).toBe("Buff");
  });

  it("normalizes labels to 24 chars and collapses whitespace", () => {
    expect(normalizeCardLabel("  hello   world  ")).toBe("hello world");
    expect(normalizeCardLabel("x".repeat(30))).toHaveLength(24);
  });
});
