/** Hard Bargain. */
import { registerCardScript } from "../sdk";

registerCardScript({
  name: "Hard Bargain",
  text: "[REACTION] (Play any time, even before spells and abilities resolve.)\n[REPEAT][2] (You may pay the additional cost to repeat this spell's effect.)\nCounter a spell unless its controller pays [2].",
  status: "implemented",
  abilities: [
    {
      kind: "spell",
      effect: {
        op: "seq",
        effects: [
          {
            op: "for_each",
            selector: { chosen: true, cardType: "spell", targetRef: "target:0" },
            effect: {
              op: "custom",
              id: "sfd:counter-unless-pay",
              params: { ref: "target:0", energy: 2 },
            },
          },
        ],
      },
    },
  ],
});
