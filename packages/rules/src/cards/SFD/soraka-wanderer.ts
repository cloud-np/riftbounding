/** Soraka, Wanderer. */
import { EVENT_SUBJECT, registerCardScript, SELF } from "../sdk";
import { HERE_ZONE } from "./custom";

registerCardScript({
  name: "Soraka, Wanderer",
  text: "I must be assigned combat damage last.\nIf another unit you control here would die, if it has less Might than me, instead heal it, exhaust it, and recall it. (Send it to base. This isn't a move.)",
  status: "partial",
  notes:
    '"I must be assigned combat damage last" is exposed as the `assigned-last` modifier, which combat damage assignment (467.2.c) does not read yet.',
  abilities: [
    {
      kind: "passive",
      modifier: { kind: "assigned-last", target: SELF },
    },
    {
      kind: "replacement",
      matches: {
        type: "kill",
        subject: {
          cardType: "unit",
          controller: "self",
          zone: HERE_ZONE,
          excludeSource: true,
          might: { op: "lt", value: { kind: "might", selector: SELF } },
        },
      },
      replace: {
        op: "seq",
        effects: [
          { op: "heal", amount: 999, target: EVENT_SUBJECT },
          { op: "exhaust", target: EVENT_SUBJECT },
          { op: "recall", target: EVENT_SUBJECT },
        ],
      },
    },
  ],
});
