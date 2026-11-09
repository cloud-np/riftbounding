/** Defiant Dance. */
import { registerCardScript } from "../sdk";
import { target } from "./custom";

registerCardScript({
  name: "Defiant Dance",
  text: "[Reaction] (Play any time, even before spells and abilities resolve.)\nGive a unit +2 [Might] this turn and another unit -2 [Might] this turn.",
  status: "implemented",
  abilities: [
    {
      kind: "spell",
      effect: {
        op: "seq",
        effects: [
          { op: "temporary_might", amount: 2, target: target({ targetRef: "target:0" }) },
          {
            op: "temporary_might",
            amount: -2,
            target: target({ targetRef: "target:1", excludeRefs: ["target:0"] }),
          },
        ],
      },
    },
  ],
});
