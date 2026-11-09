/**
 * Gentlemen's Duel (OGS-008) — "[Action] Give a friendly unit +3 [Might] this turn. Then, choose
 * an enemy unit. They deal damage equal to their Mights to each other."
 *
 * Both units are chosen on play (355.7); each is the source of the damage it deals
 * (418.6.b.3/.4), using the friendly unit's Might after the +3.
 */
import { aUnit, registerCardScript } from "../sdk";

registerCardScript({
  name: "Gentlemen's Duel",
  text: "[Action] (Play on your turn or in showdowns.)\nGive a friendly unit +3 [Might] this turn. Then, choose an enemy unit. They deal damage equal to their Mights to each other.",
  status: "implemented",
  abilities: [
    {
      kind: "spell",
      effect: {
        op: "seq",
        effects: [
          {
            op: "temporary_might",
            amount: 3,
            target: aUnit({ controller: "self", targetRef: "target:0" }),
          },
          {
            op: "deal",
            amount: { kind: "might", selector: { targetRef: "target:0" } },
            target: aUnit({ controller: "opponent", targetRef: "target:1" }),
            source: { targetRef: "target:0" },
          },
          {
            op: "deal",
            amount: { kind: "might", selector: { targetRef: "target:1" } },
            target: { targetRef: "target:0" },
            source: { targetRef: "target:1" },
          },
        ],
      },
    },
  ],
});
