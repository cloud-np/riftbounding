/** Sandshifter. */
import { registerCardScript, WHEN_PLAYED } from "../sdk";
import { ENEMY_UNIT, target } from "./custom";

registerCardScript({
  name: "Sandshifter",
  text: "When you play me, kill an enemy unit with 3 [Might] or less.",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: WHEN_PLAYED,
      effect: { op: "kill", target: target({ ...ENEMY_UNIT, might: { op: "lte", value: 3 } }) },
    },
  ],
});
