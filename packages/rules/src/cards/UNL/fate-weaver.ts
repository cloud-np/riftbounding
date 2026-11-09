/** Fate Weaver. */
import { registerCardScript, WHEN_PLAYED } from "../sdk";
import { lookRevealDraw } from "./custom";

registerCardScript({
  name: "Fate Weaver",
  text: "When you play me, look at the top 4 cards of your Main Deck. You may reveal a spell with Energy cost [4] or more from among them and draw it.\nRecycle the rest.",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: WHEN_PLAYED,
      effect: lookRevealDraw(4, { cardType: "spell", energyCost: { op: "gte", value: 4 } }),
    },
  ],
});
