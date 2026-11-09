/** Burn Away (RAD-124) — "Banish a unit with 3 [Might] or less or a gear. [Burn 2]." (428, 441) */
import type { Condition } from "@rift/protocol";
import { custom, registerCardScript } from "../sdk";

const FACE_UP = custom("rad:face-up");

function itIs(extra: Record<string, unknown>): Condition {
  return { kind: "exists", selector: { targetRef: "it", ...extra } };
}

registerCardScript({
  name: "Burn Away",
  text: "Banish a unit with 3 [Might] or less or a gear. [Burn 2]. (Put the top 2 cards of your Main Deck into your trash.)",
  status: "implemented",
  abilities: [
    {
      kind: "spell",
      effect: {
        op: "seq",
        effects: [
          {
            op: "banish",
            target: {
              chosen: true,
              where: {
                kind: "and",
                conditions: [
                  FACE_UP,
                  {
                    kind: "or",
                    conditions: [
                      itIs({ cardType: "unit", might: { op: "lte", value: 3 } }),
                      itIs({ cardType: "gear" }),
                    ],
                  },
                ],
              },
            },
          },
          { op: "burn", amount: 2, target: { controller: "self" } },
        ],
      },
    },
  ],
});
