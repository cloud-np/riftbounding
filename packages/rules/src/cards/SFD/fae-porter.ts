/** Fae Porter. */
import { registerCardScript } from "../sdk";
import { HERE_ZONE, target, WHEN_I_MOVE_TO_BATTLEFIELD } from "./custom";

registerCardScript({
  name: "Fae Porter",
  text: "When I move to a battlefield, you may pay [Chaos] to move a unit you control to the same battlefield.",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: WHEN_I_MOVE_TO_BATTLEFIELD,
      effect: {
        op: "cost_then",
        optional: true,
        cost: { power: { Chaos: 1 } },
        effect: {
          op: "move",
          target: target({ controller: "self", excludeSelf: true }),
          to: HERE_ZONE,
        },
      },
    },
  ],
});
