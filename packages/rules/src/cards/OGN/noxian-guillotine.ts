/**
 * Noxian Guillotine (OGN-254) — EX[180] (392): "Choose a unit. Kill it the next time it takes
 * damage this turn. [LEGION] - Kill it now instead."
 *
 * [Legion] is read on resolution as "you've played another card this turn" (cards played ≥ 2,
 * this one included); Legion's own timing/permission is R2-play's keyword.
 */
import { aUnit, registerCardScript } from "../sdk";

registerCardScript({
  name: "Noxian Guillotine",
  text: "[ACTION] (Play on your turn or in showdowns.)\nChoose a unit. Kill it the next time it takes damage this turn.\n[LEGION] - Kill it now instead. (Get the effect if you've played another card this turn.)",
  status: "implemented",
  abilities: [
    {
      kind: "spell",
      effect: {
        op: "if",
        condition: { kind: "cards-played", op: "gte", value: 2 },
        then: { op: "kill", target: aUnit({ targetRef: "target:0" }) },
        else: {
          // The chosen unit is validated on resolution (359.3.e), then the delayed trigger is
          // created with it bound (359.3.f.3.a).
          op: "for_each",
          selector: aUnit({ targetRef: "target:0" }),
          effect: {
            op: "delayed",
            trigger: {
              kind: "event",
              event: { type: "damage", subject: { targetRef: "target:0" } },
            },
            effect: { op: "kill", target: { targetRef: "target:0" } },
            once: true,
          },
        },
      },
    },
  ],
});
