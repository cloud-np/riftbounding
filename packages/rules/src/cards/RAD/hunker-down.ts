/** Hunker Down (RAD-034) — "Ready a friendly unit. It can't move this turn. Draw 1." (416, 054.1) */
import { aUnit, registerCardScript } from "../sdk";

registerCardScript({
  name: "Hunker Down",
  text: "[Reaction] (Play any time, even before spells and abilities resolve.)\nReady a friendly unit. It can't move this turn. Draw 1.",
  status: "implemented",
  abilities: [
    {
      kind: "spell",
      effect: {
        op: "seq",
        effects: [
          { op: "ready", target: aUnit({ controller: "self", targetRef: "target:0" }) },
          {
            op: "continuous",
            duration: "this-turn",
            modifier: {
              kind: "restriction",
              restriction: "move",
              target: { targetRef: "target:0" },
            },
          },
          { op: "draw", amount: 1 },
        ],
      },
    },
  ],
});
