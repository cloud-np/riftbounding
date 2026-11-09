/** Recurve Bow. */
import { registerCardScript, WHEN_I_ATTACK_OR_DEFEND } from "../sdk";
import { HERE_ZONE } from "./custom";

registerCardScript({
  name: "Recurve Bow",
  text: "[Equip][Fury] ([Fury]: Attach this to a unit you control.)\n\nWhen I attack or defend, deal 2 to an enemy unit here.\n+0 [Might]",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: WHEN_I_ATTACK_OR_DEFEND,
      effect: {
        op: "deal",
        amount: 2,
        target: {
          chosen: true,
          targetRef: "target:0",
          cardType: "unit",
          controller: "opponent",
          zone: HERE_ZONE,
        },
      },
    },
  ],
});
