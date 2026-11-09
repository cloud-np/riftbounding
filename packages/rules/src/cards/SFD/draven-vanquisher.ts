/** Draven, Vanquisher. */
import { registerCardScript, SELF, WHEN_I_ATTACK_OR_DEFEND } from "../sdk";
import { gold, WHEN_I_WIN_A_COMBAT } from "./custom";

registerCardScript({
  name: "Draven, Vanquisher",
  text: "When I win a combat, play a Gold gear token exhausted.\nWhen I attack or defend, you may pay [Fury] to give me +2 [Might] this turn.",
  status: "implemented",
  abilities: [
    { kind: "triggered", trigger: WHEN_I_WIN_A_COMBAT, effect: gold() },
    {
      kind: "triggered",
      trigger: WHEN_I_ATTACK_OR_DEFEND,
      effect: {
        op: "cost_then",
        optional: true,
        cost: { power: { Fury: 1 } },
        effect: { op: "temporary_might", amount: 2, target: SELF },
      },
    },
  ],
});
