/** Avalanche (RAD-079) — "Deal 3 to all units in bases." (418.1.d) */
import { registerCardScript } from "../sdk";

registerCardScript({
  name: "Avalanche",
  text: "Deal 3 to all units in bases.",
  status: "implemented",
  abilities: [
    {
      kind: "spell",
      effect: { op: "deal", amount: 3, target: { cardType: "unit", zone: "base" } },
    },
  ],
});
