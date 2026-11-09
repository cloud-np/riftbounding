/** Eclipse Herald (OGN-059 — EX[207] (424.1.a.1)) */
import { registerCardScript, SELF } from "../sdk";

registerCardScript({
  name: "Eclipse Herald",
  text: "When you stun an enemy unit, ready me and give me +1 [Might] this turn.",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: {
        kind: "event",
        event: {
          type: "stun",
          player: "self",
          subject: { cardType: "unit", controller: "opponent" },
        },
      },
      effect: {
        op: "seq",
        effects: [
          { op: "ready", target: SELF },
          { op: "temporary_might", amount: 1, target: SELF },
        ],
      },
    },
  ],
});
