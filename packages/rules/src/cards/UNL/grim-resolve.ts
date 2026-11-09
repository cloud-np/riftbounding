/**
 * Grim Resolve (UNL-095) — [Action]. Give a friendly unit +3 [Might] this turn. "When it wins a
 * combat this turn, gain 2 XP." is a delayed triggered ability (390–393) bound to the chosen unit
 * (359.3.f.3.a); it wins when it remains at the battlefield on the winning side (468.3.c).
 */
import { registerCardScript } from "../registry";
import { aUnit, custom } from "../dsl";

registerCardScript({
  name: "Grim Resolve",
  text: "[Action] (Play on your turn or in showdowns.)\nGive a friendly unit +3 [Might] this turn. When it wins a combat this turn, gain 2 XP.",
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
            op: "delayed",
            trigger: {
              kind: "event",
              event: {
                type: "combat_result",
                condition: custom("unl:unit-won-combat", { ref: "target:0" }),
              },
            },
            effect: { op: "gain_xp", amount: 2 },
            duration: "this-turn",
          },
        ],
      },
    },
  ],
});
