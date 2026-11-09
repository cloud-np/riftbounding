/** Here to Help. */
import { registerCardScript } from "../sdk";

registerCardScript({
  name: "Here to Help",
  text: "[HIDDEN]  (Hide now for [Rune] to react with later for [0].)\n[ACTION] (Play on your turn or in showdowns.)\n\nYou may play a unit from hand to a battlefield you control, reducing its cost by [3].",
  status: "implemented",
  abilities: [
    {
      kind: "spell",
      effect: {
        op: "seq",
        effects: [
          {
            op: "choose",
            key: "unit",
            selector: { cardType: "unit", zone: "hand", owner: "self" },
            min: 0,
            max: 1,
          },
          {
            op: "custom",
            id: "sfd:play-card",
            params: {
              target: { targetRef: "unit" },
              energy: 3,
              location: "controlled-battlefield",
            },
          },
        ],
      },
    },
  ],
});
