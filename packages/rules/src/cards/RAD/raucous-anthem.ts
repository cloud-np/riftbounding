/** Raucous Anthem (RAD-134) — "Ready your units and give them +3 [Might] this turn." */
import { registerCardScript } from "../sdk";

registerCardScript({
  name: "Raucous Anthem",
  text: "Ready your units and give them +3 [Might] this turn.",
  status: "implemented",
  abilities: [
    {
      kind: "spell",
      effect: {
        op: "seq",
        effects: [
          { op: "ready", target: { cardType: "unit", controller: "self" } },
          { op: "temporary_might", amount: 3, target: { cardType: "unit", controller: "self" } },
        ],
      },
    },
  ],
});
