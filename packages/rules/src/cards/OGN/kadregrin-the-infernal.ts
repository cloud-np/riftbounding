/**
 * Kadregrin the Infernal (OGN-038) — "When you play me, draw 1 for each of your [MIGHTY] units."
 * Mighty = 5+ Might (706–711); counted on resolution (359.3.f), Kadregrin itself included.
 */
import { registerCardScript } from "../registry";
import { WHEN_PLAYED } from "../dsl";

registerCardScript({
  name: "Kadregrin the Infernal",
  text: "When you play me, draw 1 for each of your [MIGHTY] units. (A unit is Mighty while it has 5+ [Might].)",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: WHEN_PLAYED,
      effect: {
        op: "draw",
        amount: { kind: "count", selector: { cardType: "unit", controller: "self", mighty: true } },
      },
    },
  ],
});
