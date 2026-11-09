/** Guards!. */
import { registerCardScript, token } from "../sdk";

registerCardScript({
  name: "Guards!",
  text: "[Hidden] (Hide now for [Rune] to react with later for [0].)\nPlay a 2 [Might] Sand Soldier unit token. Then do this: You may pay [Order] to ready it.",
  status: "implemented",
  abilities: [
    {
      kind: "spell",
      effect: {
        op: "seq",
        effects: [
          {
            op: "custom",
            id: "sfd:create-count",
            params: { amount: 1, token: token("Sand Soldier", { might: 2, play: true }) },
          },
          {
            op: "reflexive",
            effect: {
              op: "cost_then",
              optional: true,
              cost: { power: { Order: 1 } },
              effect: { op: "ready", target: { targetRef: "created" } },
            },
          },
        ],
      },
    },
  ],
});
