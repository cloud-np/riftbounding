/** Ribbon Dancer. */
import { registerCardScript } from "../sdk";
import { target, WHEN_I_MOVE_TO_BATTLEFIELD } from "./custom";

registerCardScript({
  name: "Ribbon Dancer",
  text: "When I move to a battlefield, give another friendly unit +1 [Might] this turn.",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: WHEN_I_MOVE_TO_BATTLEFIELD,
      effect: {
        op: "temporary_might",
        amount: 1,
        target: target({ controller: "self", excludeSelf: true }),
      },
    },
  ],
});
