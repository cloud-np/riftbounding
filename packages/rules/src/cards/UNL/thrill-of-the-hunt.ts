/** Thrill of the Hunt. */
import { aUnit, registerCardScript } from "../sdk";

registerCardScript({
  name: "Thrill of the Hunt",
  text: "[Reaction] (Play any time, even before spells and abilities resolve.)\n\nBanish a friendly unit, then its owner plays it to any battlefield, ignoring the cost.",
  status: "implemented",
  abilities: [
    {
      kind: "spell",
      effect: {
        op: "seq",
        effects: [
          { op: "banish", target: aUnit({ controller: "self", targetRef: "target:0" }) },
          {
            op: "play",
            target: { targetRef: "target:0" },
            cost: "ignored",
            location: { kind: "chosen", ref: "destination" },
          },
        ],
      },
    },
  ],
});
