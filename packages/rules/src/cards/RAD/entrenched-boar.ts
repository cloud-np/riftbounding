/**
 * Entrenched Boar (RAD-026) — "You may have me enter ready. If you do, I can't move this turn."
 * The choice is an optional zero-cost additional cost (355.1.a); the linked entry replacement
 * and move restriction read the paid-additional flag (369.3, 054.1).
 */
import { whileModifier as conditional, custom, registerCardScript, SELF } from "../sdk";

registerCardScript({
  name: "Entrenched Boar",
  text: "You may have me enter ready. If you do, I can't move this turn.",
  status: "implemented",
  additionalCosts: [
    {
      id: "optional:0",
      optional: true,
      cost: {},
      rule: "369.3",
      label: "Have me enter ready",
    },
  ],
  abilities: [
    {
      kind: "passive",
      modifier: conditional(custom("rad:paid-additional-self"), {
        kind: "enter-ready",
        target: SELF,
      }),
    },
    {
      kind: "passive",
      modifier: conditional(custom("rad:paid-additional-self"), {
        kind: "restriction",
        restriction: "move",
        target: SELF,
      }),
    },
  ],
});
