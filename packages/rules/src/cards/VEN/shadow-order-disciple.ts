/** Shadow Order Disciple. */
import { registerCardScript, SELF, WHEN_I_MOVE } from "../sdk";

registerCardScript({
  name: "Shadow Order Disciple",
  text: "When I move, you may [Burn 1] to give me +1 [Might] this turn. (To Burn 1, put the top card of your Main Deck into your trash.)",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: WHEN_I_MOVE,
      effect: {
        op: "may",
        effect: {
          op: "seq",
          effects: [
            { op: "burn", amount: 1, target: {} },
            {
              op: "if",
              condition: { kind: "did" },
              then: { op: "temporary_might", amount: 1, target: SELF },
            },
          ],
        },
      },
    },
  ],
});
