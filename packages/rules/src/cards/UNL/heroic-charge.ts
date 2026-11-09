/**
 * Heroic Charge (UNL-155) — [Action]. "Give a friendly unit +1 [Might] this turn and [Stun] an
 * enemy unit at its location." Two targets; the enemy must share the friendly unit's location
 * (355.7, re-checked on resolution 359.3.e.2).
 */
import { registerCardScript } from "../registry";
import { aUnit } from "../dsl";

registerCardScript({
  name: "Heroic Charge",
  text: "[Action] (Play on your turn or in showdowns.)\nGive a friendly unit +1 [Might] this turn and [Stun] an enemy unit at its location. (A stunned unit doesn't deal combat damage this turn.)",
  status: "implemented",
  abilities: [
    {
      kind: "spell",
      effect: {
        op: "seq",
        effects: [
          {
            op: "temporary_might",
            amount: 1,
            target: aUnit({ controller: "self", targetRef: "target:0" }),
          },
          {
            op: "stun",
            target: aUnit({
              controller: "opponent",
              sameLocationAs: "target:0",
              targetRef: "target:1",
            }),
          },
        ],
      },
    },
  ],
});
