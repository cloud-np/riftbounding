/**
 * Kinkou Initiate (UNL-097) — Play Effect: "draw 1 if your other units have total Might 5 or
 * more" (a conditional instruction checked on resolution, 359.3.f.2; Might as referenced, 143.2.c).
 */
import { registerCardScript } from "../registry";
import { WHEN_PLAYED } from "../dsl";

registerCardScript({
  name: "Kinkou Initiate",
  text: "When you play me, draw 1 if your other units have total Might 5 or more.",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: WHEN_PLAYED,
      effect: {
        op: "if",
        condition: {
          kind: "compare",
          left: {
            kind: "might",
            selector: { cardType: "unit", controller: "self", excludeSource: true },
          },
          op: "gte",
          right: 5,
        },
        then: { op: "draw", amount: 1 },
      },
    },
  ],
});
