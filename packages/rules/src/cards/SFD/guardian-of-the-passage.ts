/** Guardian of the Passage. */
import { registerCardScript, WHEN_I_HOLD } from "../sdk";

registerCardScript({
  name: "Guardian of the Passage",
  text: "When I hold, you may return a unit or gear from your trash to your hand.",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: WHEN_I_HOLD,
      optional: true,
      effect: {
        op: "seq",
        effects: [
          {
            op: "choose",
            key: "returned",
            selector: { zone: "trash", owner: "self", cardType: "permanent" },
            min: 1,
            max: 1,
          },
          { op: "return_to_hand", target: { targetRef: "returned" } },
        ],
      },
    },
  ],
});
