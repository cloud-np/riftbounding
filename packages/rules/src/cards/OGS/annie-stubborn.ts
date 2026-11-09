/** Annie, Stubborn (OGS-010) — "When you play me, return a spell from your trash to your hand." (383.4.a; 412 return to hand) */
import { registerCardScript, WHEN_PLAYED } from "../sdk";

registerCardScript({
  name: "Annie, Stubborn",
  text: "When you play me, return a spell from your trash to your hand.",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: WHEN_PLAYED,
      effect: {
        op: "return_to_hand",
        target: { chosen: true, cardType: "spell", zone: "trash", owner: "self" },
      },
    },
  ],
});
