/** Harpoon Squad. */
import type { Trigger } from "@rift/protocol";
import { custom, registerCardScript, SELF } from "../sdk";

/** "When I move from a battlefield". */
const WHEN_I_MOVE_FROM_BATTLEFIELD: Trigger = {
  kind: "event",
  event: {
    type: "move",
    subject: { targetRef: "self" },
    condition: custom("sfd:event-from-battlefield"),
  },
};

registerCardScript({
  name: "Harpoon Squad",
  text: "When I move from a battlefield, give me +2 [Might] this turn.",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: WHEN_I_MOVE_FROM_BATTLEFIELD,
      effect: { op: "temporary_might", amount: 2, target: SELF },
    },
  ],
});
