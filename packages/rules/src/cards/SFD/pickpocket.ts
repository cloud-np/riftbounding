/** Pickpocket. */
import { registerCardScript, WHEN_PLAYED } from "../sdk";
import { gold } from "./custom";

registerCardScript({
  name: "Pickpocket",
  text: "When you play me, you may kill a gear with Energy cost no more than [1]. If you do, play a Gold gear token exhausted.",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: WHEN_PLAYED,
      optional: true,
      effect: {
        op: "seq",
        effects: [
          {
            op: "kill",
            target: {
              chosen: true,
              cardType: "gear",
              energyCost: { op: "lte", value: 1 },
              targetRef: "target:0",
            },
          },
          { op: "if", condition: { kind: "did" }, then: gold() },
        ],
      },
    },
  ],
});
