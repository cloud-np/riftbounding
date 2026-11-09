/**
 * Delayed "would die" replacements (367–370, 391.3), created for the unit chosen on play
 * (359.3.f.3.a: the delayed `replace` keeps the creator's choices and matches its `target:0`):
 *
 * - Smite (UNL-007): [Action] Deal 3 to a unit at a battlefield. If it would die this turn, banish
 *   it instead (428).
 * - Tactical Retreat (UNL-175): [Reaction] Choose a friendly unit. The next time it would die this
 *   turn, heal it, exhaust it, and recall it instead (419, 415, 456: not a move).
 */
import { registerCardScript } from "../registry";
import { EVENT_SUBJECT, aUnit } from "../dsl";

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
