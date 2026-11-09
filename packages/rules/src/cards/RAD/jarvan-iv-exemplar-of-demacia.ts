/**
 * Jarvan IV, Exemplar of Demacia (RAD-155, legend) — "When you play a gear with [Deploy], you may
 * exhaust me and pay [Rune] to move a friendly unit to that battlefield." (383.3.b leading cost)
 */
import { aUnit, notIntrinsic, registerCardScript, SELF } from "../sdk";

registerCardScript({
  name: "Jarvan IV, Exemplar of Demacia",
  text: "When you play a gear with [Deploy], you may exhaust me and pay [Rune] to move a friendly unit to that battlefield.",
  status: "implemented",
  abilities: [
    ...notIntrinsic("Deploy"),
    {
      kind: "triggered",
      trigger: {
        kind: "event",
        event: {
          type: "gear_played",
          player: "self",
          subject: { cardType: "gear", keyword: "Deploy" },
        },
      },
      effect: {
        op: "cost_then",
        cost: { exhaust: SELF, power: { any: 1 } },
        optional: true,
        effect: {
          op: "move",
          target: aUnit({ controller: "self" }),
          to: { kind: "chosen", ref: "event-zone" },
        },
      },
    },
  ],
});
