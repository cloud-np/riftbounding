/** Safety Inspector. */
import { not, PAID_ADDITIONAL, registerCardScript, WHEN_PLAYED } from "../sdk";

registerCardScript({
  name: "Safety Inspector",
  text: "You may spend 3 XP as an additional cost to play me.\nWhen you play me, each player must kill one of their units. If you paid my additional cost, you don't kill a unit this way.",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: WHEN_PLAYED,
      effect: {
        op: "seq",
        effects: [
          {
            op: "if",
            condition: not(PAID_ADDITIONAL),
            then: {
              op: "seq",
              effects: [
                {
                  op: "choose",
                  key: "mine",
                  selector: { cardType: "unit", controller: "self" },
                  min: 1,
                  max: 1,
                  chooser: "self",
                },
                { op: "kill", target: { targetRef: "mine" } },
              ],
            },
          },
          {
            op: "choose",
            key: "theirs",
            selector: { cardType: "unit", controller: "opponent" },
            min: 1,
            max: 1,
            chooser: "opponent",
          },
          { op: "kill", target: { targetRef: "theirs" } },
        ],
      },
    },
  ],
});
