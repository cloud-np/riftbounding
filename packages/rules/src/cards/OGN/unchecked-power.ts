/**
 * Unchecked Power (OGN-123) — "Exhaust all friendly units, then deal 12 to all units at
 * battlefields." (415, 418; every matching unit, 355.5.a)
 */
import { registerCardScript } from "../sdk";

registerCardScript({
  name: "Unchecked Power",
  text: "Exhaust all friendly units, then deal 12 to all units at battlefields.",
  status: "implemented",
  abilities: [
    {
      kind: "spell",
      effect: {
        op: "seq",
        effects: [
          { op: "exhaust", target: { cardType: "unit", controller: "self" } },
          { op: "deal", amount: 12, target: { cardType: "unit", zone: "battlefield" } },
        ],
      },
    },
  ],
});
