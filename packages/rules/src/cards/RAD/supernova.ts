/** Supernova (RAD-059) — "Deal 10 to a unit. Draw 2." */
import { aUnit, registerCardScript } from "../sdk";

registerCardScript({
  name: "Supernova",
  text: "Deal 10 to a unit. Draw 2.",
  status: "implemented",
  abilities: [
    {
      kind: "spell",
      effect: {
        op: "seq",
        effects: [
          { op: "deal", amount: 10, target: aUnit() },
          { op: "draw", amount: 2 },
        ],
      },
    },
  ],
});
