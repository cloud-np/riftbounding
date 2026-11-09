/** Falling Star (OGN-029 (Spiritforged errata) — EX[287] (758.2): two separate "Deal 3 to a unit" instructions.) */
import { aUnit, registerCardScript } from "../sdk";

registerCardScript({
  name: "Falling Star",
  text: "Deal 3 to a unit.\nDeal 3 to a unit.",
  status: "implemented",
  abilities: [
    {
      kind: "spell",
      effect: {
        op: "seq",
        effects: [
          { op: "deal", amount: 3, target: aUnit() },
          { op: "deal", amount: 3, target: aUnit() },
        ],
      },
    },
  ],
});
