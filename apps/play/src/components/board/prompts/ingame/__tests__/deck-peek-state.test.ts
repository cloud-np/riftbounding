import { describe, expect, it } from "vitest";

import { deckPeekTitle, nextRevealAll, peekZone } from "../deck-peek-state";

describe("deck peek helpers", () => {
  it("defaults to the main deck and keeps rune peeks separate", () => {
    expect(peekZone(undefined)).toBe("deck");
    expect(peekZone({})).toBe("deck");
    expect(peekZone({ zone: "runeDeck" })).toBe("runeDeck");
  });

  it("uses the original titles/help copy", () => {
    expect(deckPeekTitle("deck").title).toBe("Deck Peek");
    expect(deckPeekTitle("runeDeck").title).toBe("Rune Peek");
    expect(deckPeekTitle("deck").info).toContain("Dragging a looked-at card out");
    expect(deckPeekTitle("runeDeck").info).toContain("Reveal a looked-at rune");
  });

  it("reveals all unless every looked-at card is already revealed", () => {
    expect(nextRevealAll(new Set(), ["a", "b"])).toBe(true);
    expect(nextRevealAll(new Set(["a"]), ["a", "b"])).toBe(true);
    expect(nextRevealAll(new Set(["a", "b"]), ["a", "b"])).toBe(false);
    expect(nextRevealAll(new Set(["a"]), [])).toBe(true);
  });
});
