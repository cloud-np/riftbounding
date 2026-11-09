/** Icevale Archer. */
import { aUnit, HERE, registerCardScript, WHEN_I_ATTACK } from "../sdk";

registerCardScript({
  name: "Icevale Archer",
  text: "When I attack, you may pay [1] to give a unit here -1[Might] this turn.",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: WHEN_I_ATTACK,
      effect: {
        op: "cost_then",
        optional: true,
        cost: { energy: 1 },
        effect: { op: "temporary_might", amount: -1, target: aUnit({ zone: HERE }) },
      },
    },
  ],
});
