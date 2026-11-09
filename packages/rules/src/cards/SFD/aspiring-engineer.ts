/** Aspiring Engineer. */
import { registerCardScript, WHEN_PLAYED } from "../sdk";

registerCardScript({
  name: "Aspiring Engineer",
  text: "When you play me, return a gear from your trash to your hand.",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: WHEN_PLAYED,
      effect: {
        op: "return_to_hand",
        target: { chosen: true, cardType: "gear", zone: "trash", owner: "self" },
      },
    },
  ],
});
