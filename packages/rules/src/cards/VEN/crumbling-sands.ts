/**
 * Crumbling Sands (VEN-039) — "[Reaction] Counter a spell if an opponent has played another spell
 * this turn."
 *
 * 426 counter; the condition is checked on resolution (359.3.f.2): one of your opponents played
 * (420.4, finalized-card history) a spell this turn other than the chosen one.
 */
import { registerCardScript } from "../registry";
import { custom } from "../dsl";

registerCardScript({
  name: "Crumbling Sands",
  text: "[reaction] (Play any time, even before spells and abilities resolve.)\nCounter a spell if and opponent has played another spell this turn.",
  status: "implemented",
  abilities: [
    {
      kind: "spell",
      effect: {
        op: "for_each",
        selector: { chosen: true, cardType: "spell", targetRef: "target:0" },
        effect: {
          op: "if",
          condition: custom("ven:opponent-played-another-spell", { ref: "target:0" }),
          then: { op: "counter", target: { targetRef: "target:0" } },
        },
      },
    },
  ],
});
