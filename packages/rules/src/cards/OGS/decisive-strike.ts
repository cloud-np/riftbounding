/** Decisive Strike (OGS-024) — "[ACTION] Give friendly units +2 [Might] this turn." (355.5.a: every friendly unit, not targeted) */
import { registerCardScript } from "../sdk";

registerCardScript({
  name: "Decisive Strike",
  text: "[ACTION] (Play on your turn or in showdowns.)\nGive friendly units +2 [Might] this turn.",
  status: "implemented",
  abilities: [
    {
      kind: "spell",
      effect: {
        op: "temporary_might",
        amount: 2,
        target: { cardType: "unit", controller: "self" },
      },
    },
  ],
});
