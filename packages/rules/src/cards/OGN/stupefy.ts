/** Stupefy (OGN-095 — 359.3.f.2 example; 479.4.b snapshot ("to a minimum of 1").) */
import { aUnit, registerCardScript } from "../sdk";

registerCardScript({
  name: "Stupefy",
  text: "[REACTION] (Play any time, even before spells and abilities resolve.)\nGive a unit -1 [Might] this turn, to a minimum of 1 [Might]. Draw 1.",
  status: "implemented",
  abilities: [
    {
      kind: "spell",
      effect: {
        op: "seq",
        effects: [
          { op: "give_might", amount: -1, min: 1, target: aUnit() },
          { op: "draw", amount: 1 },
        ],
      },
    },
  ],
});
