/** Overzealous Fan. */
import { custom, registerCardScript, SELF, WHEN_I_DEFEND } from "../sdk";
import { target } from "./custom";

registerCardScript({
  name: "Overzealous Fan",
  text: "When I defend, you may kill me to move an attacking unit to its base.",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: WHEN_I_DEFEND,
      effect: {
        op: "cost_then",
        optional: true,
        cost: { kill: SELF },
        effect: {
          op: "move",
          target: target({ where: custom("core:attacking", { ref: "it" }) }),
          to: "base",
        },
      },
    },
  ],
});
