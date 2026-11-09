/** Imposing Challenger. */
import { aUnit, HERE, registerCardScript, SELF, WHEN_I_MOVE } from "../sdk";

registerCardScript({
  name: "Imposing Challenger",
  text: "When I move, you may move an enemy unit here with less Might than me to a different battlefield.",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: WHEN_I_MOVE,
      effect: {
        op: "may",
        effect: {
          op: "move",
          target: aUnit({
            controller: "opponent",
            zone: HERE,
            might: { op: "lt", value: { kind: "might", selector: SELF } },
          }),
          to: "battlefield",
        },
      },
    },
  ],
});
