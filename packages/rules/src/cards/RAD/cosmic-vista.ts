/** Cosmic Vista. */
import { registerCardScript, WHEN_YOU_HOLD_HERE } from "../sdk";

/** Cosmic Vista (RAD-160) — "When you hold here, if your Rune Deck is empty, you score 1 point." (383.2.a.1, 470.2) */
const RUNE_DECK_EMPTY = {
  kind: "compare" as const,
  left: { kind: "cards-in-zone" as const, zone: "runeDeck" },
  op: "eq" as const,
  right: 0,
};

registerCardScript({
  name: "Cosmic Vista",
  text: "When you hold here, if your Rune Deck is empty, you score 1 point.",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: WHEN_YOU_HOLD_HERE,
      condition: RUNE_DECK_EMPTY,
      effect: { op: "if", condition: RUNE_DECK_EMPTY, then: { op: "score_points", amount: 1 } },
    },
  ],
});
