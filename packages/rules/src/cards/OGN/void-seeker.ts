/** Void Seeker (OGN-024 — EX[100] / EX[193] (359.3.e.5, 418.6.a)) */
import { registerCardScript } from "../registry";
import { aUnit } from "../dsl";

registerCardScript({
  name: "Void Seeker",
  text: "[ACTION] (Play on your turn or in showdowns.)\n\nDeal 4 to a unit at a battlefield. Draw 1.",
  status: "implemented",
  abilities: [
    {
      kind: "spell",
      effect: {
        op: "seq",
        effects: [
          { op: "deal", amount: 4, target: aUnit({ zone: "battlefield" }) },
          { op: "draw", amount: 1 },
        ],
      },
    },
  ],
});
