/** Iascylla. */
import { aUnit, HERE, registerCardScript, WHEN_I_HOLD } from "../sdk";

registerCardScript({
  name: "Iascylla",
  text: "When I hold, at the start of your next Main Phase, you may move an enemy unit to this battlefield.",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: WHEN_I_HOLD,
      effect: {
        op: "delayed",
        trigger: { kind: "phase", phase: "main" },
        effect: {
          op: "move",
          target: aUnit({ controller: "opponent" }),
          to: HERE,
        },
        optional: true,
        duration: "this-turn",
      },
    },
  ],
});
