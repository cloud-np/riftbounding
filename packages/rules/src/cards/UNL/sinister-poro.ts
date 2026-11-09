/** Sinister Poro. */
import { registerCardScript, WHEN_I_ATTACK } from "../sdk";
import { ENEMY_HERE } from "./custom";

registerCardScript({
  name: "Sinister Poro",
  text: "When I attack, you may pay [1] to move an enemy unit here to its base.",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: WHEN_I_ATTACK,
      effect: {
        op: "cost_then",
        optional: true,
        cost: { energy: 1 },
        effect: { op: "move", target: ENEMY_HERE, to: "base" },
      },
    },
  ],
});
