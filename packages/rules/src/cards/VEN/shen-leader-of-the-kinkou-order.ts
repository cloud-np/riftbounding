/** Shen, Leader of the Kinkou Order. */
import { registerCardScript, WHEN_I_HOLD } from "../sdk";
import { EXACTLY_ONE_OTHER_HERE } from "./custom";

registerCardScript({
  name: "Shen, Leader of the Kinkou Order",
  text: "[Shield] (+1 [Might] while I'm a defender.)\nWhen I hold, if there is exactly one other unit you control here, you score 1 point.",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: WHEN_I_HOLD,
      condition: EXACTLY_ONE_OTHER_HERE,
      effect: { op: "score_points", amount: 1 },
    },
  ],
});
