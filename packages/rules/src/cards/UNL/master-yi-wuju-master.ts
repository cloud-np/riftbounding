/**
 * Master Yi, Wuju Master (UNL-191, legend) — [Level 6] your units have +1 [Might]; [Level 11]
 * your units enter ready (369.3). Dependent abilities (824, 727.1.b) as `conditional` passives.
 */
import { registerCardScript } from "../registry";
import { custom } from "../dsl";

registerCardScript({
  name: "Master Yi, Wuju Master",
  text: "[Level 6] Your units have +1 [Might]. (While you have 6+ XP, get the effect.)\n[Level 11] Your units enter ready.",
  status: "implemented",
  abilities: [
    {
      kind: "passive",
      modifier: { kind: "while", condition: { kind: "xp-at-least", amount: 6 }, modifier: { kind: "might", amount: 1, target: { cardType: "unit", controller: "self" } } },
    },
    {
      kind: "passive",
      modifier: { kind: "while", condition: { kind: "xp-at-least", amount: 11 }, modifier: { kind: "enter-ready", target: { cardType: "unit" } } },
    },
  ],
});
