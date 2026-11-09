/**
 * Nocturne, Horrifying (OGN-194, Origins errata) — [Ganking] (printed); "As you look at or reveal
 * me from the top of your deck, you may banish me. If you do, you may play me for [Rune]."
 * A replacement-style option while a card is looked at/revealed in the deck, plus a play
 * permission from the banished zone for [A] — neither exists in the engine.
 */
import { registerCardScript } from "../registry";

registerCardScript({
  name: "Nocturne, Horrifying",
  text: "[Ganking] (I can move from battlefield to battlefield.)\nAs you look at or reveal me from the top of your deck, you\nmay banish me. If you do, you may play me for [Rune].",
  status: "partial",
  notes:
    'Not automated: "As you look at or reveal me from the top of your deck, you may banish me. If you do, you may play me for [Rune]" — no abilities of cards in the deck (385) and no alternative-cost play permission from it (420.1.a). Ganking is printed.',
  abilities: [],
});
