import { describe, expect, it } from "vitest";

import { deckPeekTitle, isDeckPeekOpen, nextRevealAll, peekZone, shouldDispatchPeekDismiss } from "../deck-peek-state";

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

describe("deck peek dismissal gating", () => {
  it("is only open in game with resolvable peeked cards", () => {
    expect(isDeckPeekOpen({ phase: "in_game", peekCardIds: ["a"], resolvedCardCount: 1 })).toBe(true);
    expect(isDeckPeekOpen({ phase: "in_game", peekCardIds: undefined, resolvedCardCount: 0 })).toBe(false);
    expect(isDeckPeekOpen({ phase: "in_game", peekCardIds: ["a"], resolvedCardCount: 0 })).toBe(false);
    expect(isDeckPeekOpen({ phase: "lobby", peekCardIds: ["a"], resolvedCardCount: 1 })).toBe(false);
  });

  it("never dispatches dismiss_deck_peek when no peek is open or in strict rooms", () => {
    expect(shouldDispatchPeekDismiss({ open: false })).toBe(false);
    expect(shouldDispatchPeekDismiss({ open: false, rulesMode: "sandbox" })).toBe(false);
    expect(shouldDispatchPeekDismiss({ open: true, rulesMode: "strict" })).toBe(false);
    expect(shouldDispatchPeekDismiss({ open: true })).toBe(true);
    expect(shouldDispatchPeekDismiss({ open: true, rulesMode: "sandbox" })).toBe(true);
  });
});
