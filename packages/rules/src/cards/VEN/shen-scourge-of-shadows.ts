/** Shen, Scourge of Shadows. */
import { registerCardScript, WHEN_I_HOLD } from "../sdk";
import { EXACTLY_ONE_OTHER_HERE } from "./custom";

registerCardScript({
  name: "Shen, Scourge of Shadows",
  text: "When I hold, if there is exactly one other unit you control here, draw 1.",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: WHEN_I_HOLD,
      condition: EXACTLY_ONE_OTHER_HERE,
      effect: { op: "draw", amount: 1 },
    },
  ],
});
