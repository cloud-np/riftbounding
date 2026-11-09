/** Dropboarder. */
import { registerCardScript, SELF, WHEN_PLAYED } from "../sdk";

registerCardScript({
  name: "Dropboarder",
  text: "When you play me, if you control two or more gear, ready me.",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: WHEN_PLAYED,
      condition: {
        kind: "count",
        selector: { cardType: "gear", controller: "self" },
        comparison: { op: "gte", value: 2 },
      },
      effect: { op: "ready", target: SELF },
    },
  ],
});
