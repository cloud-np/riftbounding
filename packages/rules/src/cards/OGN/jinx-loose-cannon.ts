/**
 * Jinx, Loose Cannon (OGN-251, legend) — "At start of your Beginning Phase, draw 1 if you have 1 or
 * fewer cards in your hand." (315.2.a.1; the "if" is checked on resolution, 359.3.f.2)
 */
import { registerCardScript } from "../sdk";

registerCardScript({
  name: "Jinx, Loose Cannon",
  text: "At start of your Beginning Phase, draw 1 if you have 1 or fewer cards in your hand.",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: { kind: "phase", phase: "beginning" },
      effect: {
        op: "if",
        condition: { kind: "compare", left: { kind: "cards-in-hand" }, op: "lte", right: 1 },
        then: { op: "draw", amount: 1 },
      },
    },
  ],
});
