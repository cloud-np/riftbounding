/**
 * Dragon's Rage (OGN-258, Origins errata) — "Move an enemy unit. Then do this: Choose another
 * enemy unit at its destination. They deal damage equal to their Mights to each other."
 *
 * "Then do this:" is a reflexive trigger (387–389): its choice is made when it finalizes
 * (355.5.b), at the moved unit's destination; each unit is the source of its damage (418.6.b).
 */
import { registerCardScript } from "../registry";
import { aUnit } from "../dsl";

registerCardScript({
  name: "Dragon's Rage",
  text: "Move an enemy unit. Then do this: Choose another enemy\nunit at its destination. They deal damage equal to their\nMights to each other.",
  status: "implemented",
  abilities: [
    {
      kind: "spell",
      effect: {
        op: "seq",
        effects: [
          {
            op: "move",
            target: aUnit({ controller: "opponent", targetRef: "target:0" }),
            to: { kind: "chosen", ref: "destination" },
          },
          {
            op: "reflexive",
            effect: {
              op: "seq",
              effects: [
                {
                  op: "deal",
                  amount: { kind: "might", selector: { targetRef: "target:0" } },
                  target: aUnit({
                    controller: "opponent",
                    sameLocationAs: "target:0",
                    excludeRefs: ["target:0"],
                    targetRef: "target:1",
                  }),
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
      },
    },
  ],
});
