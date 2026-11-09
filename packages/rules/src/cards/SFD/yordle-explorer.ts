/** Yordle Explorer. */
import { custom, registerCardScript } from "../sdk";

registerCardScript({
  name: "Yordle Explorer",
  text: "When you play a card with Power cost [Rune][Rune] or more, draw 1.",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      // 420.4.a: "when you play a card" triggers as playing completes (the card resolves).
      trigger: {
        kind: "event",
        event: {
          type: "played",
          player: "self",
          condition: custom("sfd:event-card-power-at-least", { n: 2 }),
        },
      },
      effect: { op: "draw", amount: 1 },
    },
  ],
});
