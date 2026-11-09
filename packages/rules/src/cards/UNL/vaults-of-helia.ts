/** Vaults of Helia. */
import { registerCardScript, WHEN_YOU_HOLD_HERE } from "../sdk";

registerCardScript({
  name: "Vaults of Helia",
  text: "When you hold here, your non-token units cost [1] more to play this turn.",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: WHEN_YOU_HOLD_HERE,
      effect: {
        op: "continuous",
        modifier: {
          kind: "cost",
          amount: 1,
          target: { cardType: "unit", controller: "self", token: false },
        },
        duration: "this-turn",
      },
    },
  ],
});
