/** Insightful Investigator. */
import { registerCardScript, WHEN_PLAYED } from "../sdk";

registerCardScript({
  name: "Insightful Investigator",
  text: "When you play me, choose an opponent. They reveal their hand. You may pay 2 XP to choose a card from their hand. If you do, they discard that card and draw 1.",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: WHEN_PLAYED,
      effect: {
        op: "seq",
        effects: [
          { op: "reveal", target: { zone: "hand", controller: "opponent", all: true } },
          {
            op: "cost_then",
            optional: true,
            cost: { spendXp: 2 },
            effect: {
              op: "seq",
              effects: [
                {
                  op: "choose",
                  key: "chosen-card",
                  selector: { zone: "hand", controller: "opponent" },
                  min: 1,
                  max: 1,
                  chooser: "self",
                },
                { op: "custom", id: "unl:discard-ref", params: { ref: "chosen-card" } },
                { op: "draw", amount: 1, player: "opponent" },
              ],
            },
          },
        ],
      },
    },
  ],
});
