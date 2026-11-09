/** Beast Below. */
import { registerCardScript, WHEN_PLAYED } from "../sdk";
import { ENEMY_UNIT, target } from "./custom";

registerCardScript({
  name: "Beast Below",
  text: "When you play me, return another friendly unit and an enemy unit to their owners' hands.",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: WHEN_PLAYED,
      effect: {
        op: "seq",
        effects: [
          { op: "return_to_hand", target: target({ controller: "self", excludeSelf: true }) },
          { op: "return_to_hand", target: target(ENEMY_UNIT) },
        ],
      },
    },
  ],
});
