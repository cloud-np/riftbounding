/**
 * Disposal Expert (RAD-093) — "I enter ready if you control no other units. [Disarm 2]".
 * A conditional entry replacement (364.3.a, 369.3), checked as it enters.
 */
import { whileModifier as conditional, registerCardScript, SELF } from "../sdk";

registerCardScript({
  name: "Disposal Expert",
  text: "I enter ready if you control no other units.\n[Disarm 2] (When I attack, give an enemy unit here -2[Might] this turn.)",
  status: "implemented",
  abilities: [
    {
      kind: "passive",
      modifier: conditional(
        {
          kind: "not",
          condition: {
            kind: "exists",
            selector: { cardType: "unit", controller: "self", excludeSource: true },
          },
        },
        { kind: "enter-ready", target: SELF },
      ),
    },
  ],
});
