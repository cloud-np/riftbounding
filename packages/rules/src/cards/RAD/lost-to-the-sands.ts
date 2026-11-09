/** Lost to the Sands (RAD-013) — "Choose one — Deal 4 to a unit at a battlefield. / Kill a gear." (355.3) */
import { aUnit, registerCardScript } from "../sdk";

registerCardScript({
  name: "Lost to the Sands",
  text: "[Action] (Play on your turn or in showdowns.)\nChoose one —\n• Deal 4 to a unit at a battlefield.\n• Kill a gear.",
  status: "implemented",
  abilities: [
    {
      kind: "spell",
      effect: {
        op: "choose_mode",
        modes: [
          {
            id: "deal",
            label: "Deal 4 to a unit at a battlefield",
            effect: { op: "deal", amount: 4, target: aUnit({ zone: "battlefield" }) },
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
