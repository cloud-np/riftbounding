/**
 * Realm of Death (RAD-144) — "Give an enemy unit -2 [Might] this turn and a friendly unit +2
 * [Might] this turn. They deal damage equal to their Mights to each other." (418.6.b.3/.4)
 */
import { aUnit, registerCardScript } from "../sdk";

registerCardScript({
  name: "Realm of Death",
  text: "Give an enemy unit -2 [Might] this turn and a friendly unit +2 [Might] this turn. They deal damage equal to their Mights to each other.",
  status: "implemented",
  abilities: [
    {
      kind: "spell",
      effect: {
        op: "seq",
        effects: [
          {
            op: "temporary_might",
            amount: -2,
            target: aUnit({ controller: "opponent", targetRef: "target:0" }),
          },
          {
            op: "temporary_might",
            amount: 2,
            target: aUnit({ controller: "self", targetRef: "target:1" }),
          },
          {
            op: "deal",
            amount: { kind: "might", selector: { targetRef: "target:1" } },
            target: { targetRef: "target:0" },
            source: { targetRef: "target:1" },
          },
          {
            op: "deal",
            amount: { kind: "might", selector: { targetRef: "target:0" } },
            target: { targetRef: "target:1" },
            source: { targetRef: "target:0" },
          },
        ],
      },
    },
  ],
});
