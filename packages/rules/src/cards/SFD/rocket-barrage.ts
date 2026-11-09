/** Rocket Barrage. */
import { registerCardScript } from "../sdk";
import { target } from "./custom";

registerCardScript({
  name: "Rocket Barrage",
  text: "[REPEAT][4][Mind] (You may pay the additional cost to repeat this spell's effect, and may make different choices.)\nChoose one —\n- Deal 4 to a unit in a base.\n- Kill a gear.",
  status: "implemented",
  abilities: [
    {
      kind: "spell",
      effect: {
        op: "choose_mode",
        modes: [
          {
            id: "deal",
            label: "Deal 4 to a unit in a base",
            effect: { op: "deal", amount: 4, target: target({ zone: "base" }) },
          },
          {
            id: "kill",
            label: "Kill a gear",
            effect: { op: "kill", target: { chosen: true, cardType: "gear" } },
          },
        ],
      },
    },
  ],
});
