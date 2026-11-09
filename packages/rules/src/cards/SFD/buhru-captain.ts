/** Buhru Captain. */
import { registerCardScript, SELF, WHEN_PLAYED } from "../sdk";

registerCardScript({
  name: "Buhru Captain",
  text: "When you play me, you may draw 1 or buff me. (To buff a unit, give it  +1 [Might] buff if it doesn't already have one.)",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: WHEN_PLAYED,
      optional: true,
      effect: {
        op: "choose_mode",
        modes: [
          { id: "draw", label: "Draw 1", effect: { op: "draw", amount: 1 } },
          { id: "buff", label: "Buff me", effect: { op: "buff", target: SELF } },
        ],
      },
    },
  ],
});
