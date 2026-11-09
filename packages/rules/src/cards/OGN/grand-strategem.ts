/** Grand Strategem (OGN-233) — "Give friendly units +5 [Might] this turn." (479.4; the units on the board at resolution) */
import { registerCardScript } from "../sdk";

registerCardScript({
  name: "Grand Strategem",
  text: "[ACTION] (Play on your turn or in showdowns.)\nGive friendly units +5 [Might] this turn.",
  status: "implemented",
  abilities: [
    {
      kind: "spell",
      effect: {
        op: "temporary_might",
        amount: 5,
        target: { cardType: "unit", controller: "self" },
      },
    },
  ],
});
