/**
 * Defy (OGN-045) — "[REACTION] Counter a spell that costs no more than [4] and no more than
 * [Rune]." (426; the spell must be a finalized spell on the chain, 355.9.a.2)
 */
import { registerCardScript } from "../registry";

registerCardScript({
  name: "Defy",
  text: "[REACTION] Counter a spell that costs no more than [4] and no more than [Rune].",
  status: "implemented",
  abilities: [
    {
      kind: "spell",
      effect: {
        op: "counter",
        target: {
          chosen: true,
          cardType: "spell",
          energyCost: { op: "lte", value: 4 },
          powerCost: { op: "lte", value: 1 },
        },
      },
    },
  ],
});
