/** Ripper's Bay. */
import { HERE, registerCardScript } from "../sdk";

registerCardScript({
  name: "Ripper's Bay",
  text: "When a unit here is returned to a player's hand, that player may pay [1] to channel 1 rune exhausted.",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: { kind: "event", event: { type: "return_to_hand", from: HERE, cardType: "unit" } },
      effect: {
        op: "cost_then",
        optional: true,
        cost: { energy: 1 },
        effect: { op: "channel", amount: 1, exhausted: true },
      },
    },
  ],
});
