/** Amateur Recital. */
import { aUnit, registerCardScript, WHEN_YOU_HOLD_HERE } from "../sdk";

registerCardScript({
  name: "Amateur Recital",
  text: "When you hold here, you may move a unit at a battlefield to its base.",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: WHEN_YOU_HOLD_HERE,
      optional: true,
      effect: { op: "move", target: aUnit({ zone: "battlefield" }), to: "base" },
    },
  ],
});
