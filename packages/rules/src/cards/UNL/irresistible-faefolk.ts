/** Irresistible Faefolk. */
import { aUnit, registerCardScript, WHEN_I_MOVE } from "../sdk";
import { MOVED_TO_BATTLEFIELD } from "./custom";

registerCardScript({
  name: "Irresistible Faefolk",
  text: "When I move to a battlefield, you may move an enemy unit to that battlefield.",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: WHEN_I_MOVE,
      condition: MOVED_TO_BATTLEFIELD,
      effect: {
        op: "may",
        effect: {
          op: "move",
          target: aUnit({ controller: "opponent" }),
          to: { kind: "chosen", ref: "event-zone" },
        },
      },
    },
  ],
});
