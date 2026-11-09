/** Tactical Retreat. */
import { aUnit, EVENT_SUBJECT, registerCardScript } from "../sdk";

registerCardScript({
  name: "Tactical Retreat",
  text: "[Reaction] (Play any time, even before spells and abilities resolve.)\nChoose a friendly unit. The next time it would die this turn, heal it, exhaust it, and recall it instead.\n(Send it to base. This isn't a move.)",
  status: "implemented",
  abilities: [
    {
      kind: "spell",
      effect: {
        op: "for_each",
        selector: aUnit({ controller: "self", targetRef: "target:0" }),
        effect: {
          op: "replace",
          matches: { type: "kill", subject: { targetRef: "target:0" } },
          replace: {
            op: "seq",
            effects: [
              { op: "heal", amount: 99, target: EVENT_SUBJECT },
              { op: "exhaust", target: EVENT_SUBJECT },
              { op: "recall", target: EVENT_SUBJECT },
            ],
          },
        },
      },
    },
  ],
});
