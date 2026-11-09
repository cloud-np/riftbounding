/** Patched Porobot. */
import { registerCardScript, WHEN_PLAYED } from "../sdk";

registerCardScript({
  name: "Patched Porobot",
  text: "(I enter exhausted.)\nWhen you play me, if you control 3 or more other gear, draw 1.",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: WHEN_PLAYED,
      // 383.2.a.1: the "if" is part of the trigger condition. I'm a Unit Gear (I count as gear).
      condition: {
        kind: "count",
        selector: { cardType: "gear", controller: "self", excludeSource: true },
        comparison: { op: "gte", value: 3 },
      },
      effect: { op: "draw", amount: 1 },
    },
  ],
});
