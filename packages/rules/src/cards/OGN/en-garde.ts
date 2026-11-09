/**
 * En Garde (OGN-046) — "[REACTION] Give a friendly unit +1 [Might] this turn, then an additional
 * +1 [Might] this turn if it is the only unit you control there." (740.2.a "alone")
 */
import { aUnit, custom, registerCardScript } from "../sdk";

registerCardScript({
  name: "En Garde",
  text: "[REACTION] Give a friendly unit +1 [Might] this turn, then an additional +1 [Might] this turn if it is the only unit you control there.",
  status: "implemented",
  abilities: [
    {
      kind: "spell",
      effect: {
        op: "seq",
        effects: [
          { op: "temporary_might", amount: 1, target: aUnit({ controller: "self", targetRef: "target:0" }) },
          {
            op: "if",
            condition: { kind: "alone", ref: "target:0" },
            then: { op: "temporary_might", amount: 1, target: { targetRef: "target:0" } },
          },
        ],
      },
    },
  ],
});
