/**
 * Divining Shells (UNL-161) — [Vision] (817, engine keyword trigger). "[Action] Kill this, [Tap]:
 * Give a unit +2 [Might] this turn." — the [Action] belongs to the ability (135.2.e.7), not the
 * gear, so the catalog's card-level [Action] is suppressed.
 */
import { registerCardScript } from "../registry";
import { SELF, aUnit } from "../dsl";

registerCardScript({
  name: "Divining Shells",
  text: "[Vision] (When you play this, look at the top card of your Main Deck. You may recycle it.)\n[Action] Kill this, [tap] : Give a unit +2 [might] this turn.",
  status: "implemented",
  abilities: [
    { kind: "keyword", keyword: "Action", value: 0 },
    {
      kind: "activated",
      cost: { kill: SELF, exhaust: SELF },
      keywords: ["action"],
      effect: { op: "temporary_might", amount: 2, target: aUnit() },
    },
  ],
});
