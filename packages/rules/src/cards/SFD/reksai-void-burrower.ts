/** Rek'Sai, Void Burrower. */
import { registerCardScript, SELF, WHEN_YOU_CONQUER } from "../sdk";

registerCardScript({
  name: "Rek'Sai, Void Burrower",
  text: "When you conquer, you may exhaust me to reveal the top 2 cards of your Main Deck. You may banish one, then play it. Recycle the rest.",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: WHEN_YOU_CONQUER,
      effect: {
        op: "cost_then",
        optional: true,
        cost: { exhaust: SELF },
        effect: {
          op: "custom",
          id: "sfd:reveal-banish-play",
          params: { reveal: 2, rest: "recycle" },
        },
      },
    },
  ],
});
