/** Blind Fury — reveal each opponent's top card, banish one and play it ignoring cost (425, 420.3). */
import { registerCardScript } from "../registry";

registerCardScript({
  name: "Blind Fury",
  text: "[Action] Each opponent reveals the top card of their Main Deck. Choose one and banish it, then play it, ignoring its cost. Then recycle the rest.",
  status: "manual",
  notes:
    "Not automated: reveal-top for each opponent, choosing among the revealed cards and playing a card from the opponent's deck zone (no cross-player reveal-and-play op, 420.3).",
  abilities: [],
});
