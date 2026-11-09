/**
 * Delayed "would die" replacements (367–370, 391.3) created for a chosen unit (`unl:replace-next-
 * death`, once, this turn):
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
        selector: aUnit({ zone: "battlefield" }),
        effect: {
          op: "seq",
          effects: [
            {
              op: "custom",
              id: "unl:replace-next-death",
              params: { replace: { op: "banish", target: EVENT_SUBJECT } },
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
        selector: aUnit({ controller: "self" }),
        effect: {
          op: "custom",
          id: "unl:replace-next-death",
          params: {
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
    },
  ],
});
