/** Star-Crossed (UNL-128) — [Reaction]. Return a friendly unit and an enemy unit to their owners' hands (056; two targets 355.7). */
import { aUnit, registerCardScript } from "../sdk";

registerCardScript({
  name: "Star-Crossed",
  text: "[Reaction] (Play at any time, even before spells and abilities resolve.)\nReturn a friendly unit and an enemy unit to their owners hands.",
  status: "implemented",
  abilities: [
    {
      kind: "spell",
      effect: {
        op: "seq",
        effects: [
          { op: "return_to_hand", target: aUnit({ controller: "self", targetRef: "target:0" }) },
          {
            op: "return_to_hand",
            target: aUnit({ controller: "opponent", targetRef: "target:1" }),
          },
        ],
      },
    },
  ],
});
