/** Altar of Memories. */
import { registerCardScript, SELF } from "../sdk";

registerCardScript({
  name: "Altar of Memories",
  text: "When a friendly unit dies, you may exhaust me to draw 1, then put a card from your hand on the top or bottom of your Main Deck.",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: {
        kind: "event",
        event: { type: "die", subject: { cardType: "unit", controller: "self" } },
      },
      effect: {
        op: "cost_then",
        optional: true,
        cost: { exhaust: SELF },
        effect: {
          op: "seq",
          effects: [
            { op: "draw", amount: 1 },
            { op: "custom", id: "sfd:hand-to-deck-top-or-bottom" },
          ],
        },
      },
    },
  ],
});
