/** Shadow Temple. */
import { registerCardScript, WHEN_YOU_HOLD_HERE } from "../sdk";

registerCardScript({
  name: "Shadow Temple",
  text: "When you hold here, [burn 3]. (Put the top 3 cards of your Main Deck into your trash.)",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: WHEN_YOU_HOLD_HERE,
      effect: { op: "burn", amount: 3, target: {} },
    },
  ],
});
