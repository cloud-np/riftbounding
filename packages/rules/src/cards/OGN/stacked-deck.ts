/**
 * Stacked Deck (OGN-183) — "[Action] Look at the top 3 cards of your Main Deck. Put 1 into your hand
 * and recycle the rest."
 *
 * Registers `ogn:put-in-hand`: puts the referenced cards into their owner's hand (056) without
 * drawing (414) and without a `return_to_hand` event (they never were on the board). The kept card
 * is a pick among the looked-at cards (355.18); the others are recycled (417).
 */
import { not, registerCardScript } from "../sdk";

registerCardScript({
  name: "Stacked Deck",
  text: "[Action] (play on your turn or in showdowns.)\nLook at the top 3 cards of your Main Deck. Put 1 into your hand and recycle the rest.",
  status: "implemented",
  abilities: [
    {
      kind: "spell",
      effect: {
        op: "look",
        amount: 3,
        then: {
          op: "seq",
          effects: [
            {
              op: "choose",
              key: "kept",
              selector: { zone: "deck", owner: "self", where: { kind: "in-ref", ref: "looked" } },
              min: 1,
              max: 1,
            },
            { op: "custom", id: "ogn:put-in-hand", params: { target: { targetRef: "kept" } } },
            {
              op: "recycle",
              target: { targetRef: "looked", where: not({ kind: "in-ref", ref: "kept" }) },
            },
          ],
        },
      },
    },
  ],
});
