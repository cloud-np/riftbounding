/**
 * Siphon Power (OGN-266) — "[REACTION] Choose a battlefield. Give friendly units there +1 [Might]
 * this turn and enemy units there -1 [Might] this turn, to a minimum of 1 [Might]."
 *
 * The battlefield (a battlefield object, 053) is chosen when playing (355.7). The units "there" are
 * read on resolution (359.3.f); the -1 has a per-unit 479.4.b minimum snapshot.
 */
import { registerCardScript } from "../sdk";

const THERE = { kind: "chosen", ref: "target:0" } as const;

registerCardScript({
  name: "Siphon Power",
  text: "[REACTION] (Play any time, even before spells and abilities resolve.)\nChoose a battlefield. Give friendly units there +1 [Might] this turn and enemy units there -1 [Might] this turn, to a minimum of 1 [Might].",
  status: "implemented",
  abilities: [
    {
      kind: "spell",
      effect: {
        op: "for_each",
        selector: { chosen: true, cardType: "battlefield", targetRef: "target:0" },
        effect: {
          op: "seq",
          effects: [
            {
              op: "temporary_might",
              amount: 1,
              target: { cardType: "unit", controller: "self", zone: THERE },
            },
            {
              op: "give_might",
              amount: -1,
              min: 1,
              target: { cardType: "unit", controller: "opponent", zone: THERE },
            },
          ],
        },
      },
    },
  ],
});
