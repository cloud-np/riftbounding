/** Minefield. */
import { registerCardScript, WHEN_YOU_CONQUER_HERE } from "../sdk";

registerCardScript({
  name: "Minefield",
  text: "When you conquer here, put the top 2 cards of your Main Deck into your trash.",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: WHEN_YOU_CONQUER_HERE,
      effect: { op: "custom", id: "sfd:mill", params: { amount: 2 } },
    },
  ],
});
