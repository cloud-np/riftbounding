/**
 * Monster Harpoon (UNL-014) — "Deal 2 to a unit at a battlefield. If you control a facedown card,
 * deal 4 to it instead." The condition is checked on resolution (359.3.f.2); facedown = 107.3/811.
 */
import { aUnit, custom, registerCardScript } from "../sdk";

const TARGET = aUnit({ zone: "battlefield", targetRef: "target:0" });

registerCardScript({
  name: "Monster Harpoon",
  text: "[Action] (Play on your turn or in showdowns.)\nDeal 2 to a unit at a battlefield. If you control a facedown card, deal 4 to it instead.",
  status: "implemented",
  abilities: [
    {
      kind: "spell",
      effect: {
        op: "if",
        condition: custom("unl:controls-facedown"),
        then: { op: "deal", amount: 4, target: TARGET },
        else: { op: "deal", amount: 2, target: TARGET },
      },
    },
  ],
});
