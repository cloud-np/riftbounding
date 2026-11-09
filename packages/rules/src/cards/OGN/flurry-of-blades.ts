/** Flurry of Blades (OGN-133) — "Deal 1 to all units at battlefields." (418.1.d: one deal action, every unit) */
import { registerCardScript } from "../sdk";

registerCardScript({
  name: "Flurry of Blades",
  text: "[Reaction] (Play any time, even before spells and abilities resolve.)\n\nDeal 1 to all units at battlefields.",
  status: "implemented",
  abilities: [
    {
      kind: "spell",
      effect: { op: "deal", amount: 1, target: { cardType: "unit", zone: "battlefield" } },
    },
  ],
});
