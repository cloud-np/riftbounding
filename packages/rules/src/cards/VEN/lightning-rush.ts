/** Lightning Rush. */
import { registerCardScript } from "../sdk";

registerCardScript({
  name: "Lightning Rush",
  text: "Look at the top 3 cards of your Main Deck. You may choose a card from among them and draw it. Put the rest into your trash.\n[Flow][2][Rune] (You may play this from your trash for its Flow cost. Then banish it.)",
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
              key: "drawn",
              selector: { zone: "deck", where: { kind: "in-ref", ref: "looked" } },
              min: 0,
              max: 1,
              label: "Choose a card to draw",
            },
            // "Put the rest into your trash": every looked-at card but the chosen one; the chosen
            // card is then the top of the Main Deck (looked-at cards are its top cards).
            { op: "custom", id: "ven:trash-rest-of-looked", params: { keep: "drawn" } },
            {
              op: "draw",
              amount: { kind: "count", selector: { targetRef: "drawn", zone: "deck" } },
            },
          ],
        },
      },
    },
  ],
});
