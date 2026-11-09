/** Smite. */
import { aUnit, EVENT_SUBJECT, registerCardScript } from "../sdk";

registerCardScript({
  name: "Smite",
  text: "[Action] (Play on your turn or in showdowns.)\nDeal 3 to a unit at a battlefield. If it would die this turn, banish it instead.",
  status: "implemented",
  abilities: [
    {
      kind: "spell",
      effect: {
        op: "for_each",
        selector: aUnit({ zone: "battlefield", targetRef: "target:0" }),
        effect: {
          op: "seq",
          effects: [
            {
              op: "replace",
              matches: { type: "kill", subject: { targetRef: "target:0" } },
              replace: { op: "banish", target: EVENT_SUBJECT },
            },
            { op: "deal", amount: 3, target: { targetRef: "it" } },
          ],
        },
      },
    },
  ],
});
