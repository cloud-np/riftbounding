/**
 * Icathian Rain (OGN-248, Spiritforged errata) — "Deal 2 to a unit." six times: six instructions,
 * each with its own target (355.7; the same unit may be chosen for several of them).
 */
import { registerCardScript } from "../registry";
import { aUnit } from "../dsl";

registerCardScript({
  name: "Icathian Rain",
  text: "Deal 2 to a unit.\nDeal 2 to a unit.\nDeal 2 to a unit.\nDeal 2 to a unit.\nDeal 2 to a unit.\nDeal 2 to a unit.",
  status: "implemented",
  abilities: [
    {
      kind: "spell",
      effect: {
        op: "seq",
        effects: Array.from({ length: 6 }, () => ({
          op: "deal" as const,
          amount: 2,
          target: aUnit(),
        })),
      },
    },
  ],
});
