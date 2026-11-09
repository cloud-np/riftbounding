/** Decree of Rage (VEN-015) — "[Action] This can't be countered. Deal 4 to an enemy Calm unit." */
import { registerCardScript } from "../registry";
import { aUnit, custom } from "../dsl";

registerCardScript({
  name: "Decree of Rage",
  text: "[action] (Play on your turn or in showdowns.)\nThis can't be countered.\nDeal 4 to an enemy Calm ([calm]) unit.",
  status: "partial",
  notes:
    "'This can't be countered' is not automated: there is no counter restriction for chain items (426, 054.1).",
  abilities: [
    {
      kind: "spell",
      effect: {
        op: "deal",
        amount: 4,
        target: aUnit({
          controller: "opponent",
          where: custom("ven:has-domain", { domain: "Calm" }),
        }),
      },
    },
  ],
});
