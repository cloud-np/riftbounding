/**
 * Moonfall (UNL-198) — [Action]. "Choose a battlefield where you have units. You may move up to
 * one enemy unit to that battlefield. Then give enemy units there -2 [Might] this turn."
 * The battlefield is a chosen battlefield object (355.7) filtered to ones where you have units;
 * "up to one" enemy unit is chosen on play (355.13) and moved (421).
 */
import { custom, registerCardScript } from "../sdk";

const THAT_BATTLEFIELD = { kind: "chosen", ref: "battlefield" } as const;

registerCardScript({
  name: "Moonfall",
  text: "[Action] (Play on your turn or in showdowns.)\nChoose a battlefield where you have units. You may move up to one enemy unit to that battlefield. Then give enemy units there -2 [Might] this turn.",
  status: "implemented",
  abilities: [
    {
      kind: "spell",
      effect: {
        op: "for_each",
        selector: {
          chosen: true,
          cardType: "battlefield",
          targetRef: "battlefield",
          where: custom("core:you-have-units-at-it"),
        },
        effect: {
          op: "seq",
          effects: [
            {
              op: "move",
              target: {
                chosen: true,
                cardType: "unit",
                controller: "opponent",
                maxCount: 1,
                targetRef: "target:0",
              },
              to: THAT_BATTLEFIELD,
            },
            {
              op: "temporary_might",
              amount: -2,
              target: {
                cardType: "unit",
                controller: "opponent",
                all: true,
                zone: THAT_BATTLEFIELD,
              },
            },
          ],
        },
      },
    },
  ],
});
