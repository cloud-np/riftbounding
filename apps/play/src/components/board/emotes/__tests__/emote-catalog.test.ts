import { describe, expect, it } from "vitest";

import {
  DEFAULT_EMOTE_WHEEL,
  EMOTES,
  EMOTE_BY_ID,
  emoteWheelPosition,
  isValidEmoteWheel,
  resolveEmoteWheel,
  swapEmoteWheelSlot,
} from "../emote-catalog";

describe("emote catalogue", () => {
  it("contains the original emoji ids and Poro pack", () => {
    expect(EMOTES).toHaveLength(24);
    expect(EMOTE_BY_ID.get("thumbs_up")?.glyph).toBe("👍");
    expect(EMOTE_BY_ID.get("wow")?.label).toBe("No");
    expect(EMOTE_BY_ID.get("cry")?.label).toBe("Wait");
    expect(EMOTE_BY_ID.get("poro_party")?.pack).toBe("poro");
  });

  it("validates exactly six unique ids", () => {
    expect(isValidEmoteWheel(DEFAULT_EMOTE_WHEEL)).toBe(true);
    expect(isValidEmoteWheel(["thumbs_up", "heart", "laugh", "wow", "cry"])).toBe(false);
    expect(isValidEmoteWheel(["thumbs_up", "heart", "laugh", "wow", "cry", "cry"])).toBe(false);
    expect(isValidEmoteWheel(["thumbs_up", "heart", "laugh", "wow", "cry", "nope"])).toBe(false);
  });

  it("falls back to the default wheel", () => {
    expect(resolveEmoteWheel(null)).toEqual([...DEFAULT_EMOTE_WHEEL]);
    expect(resolveEmoteWheel(["nope"])).toEqual([...DEFAULT_EMOTE_WHEEL]);
  });

  it("swaps with e6.q semantics", () => {
    const wheel = [...DEFAULT_EMOTE_WHEEL];
    expect(swapEmoteWheelSlot(wheel, 0, "wave")).toEqual([
      "wave",
      "heart",
      "laugh",
      "wow",
      "cry",
      "angry",
    ]);
    expect(swapEmoteWheelSlot(wheel, 0, "heart")).toEqual([
      "heart",
      "thumbs_up",
      "laugh",
      "wow",
      "cry",
      "angry",
    ]);
  });

  it("positions six slots at 60° steps around an 82px centre / 52px radius", () => {
    const first = emoteWheelPosition(0);
    expect(first.left).toBeCloseTo(82);
    expect(first.top).toBeCloseTo(30);
    const third = emoteWheelPosition(3);
    expect(third.left).toBeCloseTo(82);
    expect(third.top).toBeCloseTo(134);
    expect(
      new Set([0, 1, 2, 3, 4, 5].map((index) => emoteWheelPosition(index).left)).size,
    ).toBeGreaterThan(3);
  });
});
