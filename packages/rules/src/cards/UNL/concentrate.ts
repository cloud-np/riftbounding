/**
 * Concentrate (UNL-091) — Draw 2. [Level 6] this costs [2] less; [Level 11] [4] less instead.
 * Cost passives of the card apply from the hand (366.2.a); "instead" = only one applies (356.4).
 */
import { registerCardScript } from "../registry";
import { SELF, custom, not } from "../dsl";

registerCardScript({
  name: "Concentrate",
  text: "Draw 2.\n[Level 6] this costs [2] less. (While you have 6+ XP, get the effect.)\n[Level 11] this costs [4] less instead.",
  status: "implemented",
  abilities: [
    { kind: "spell", effect: { op: "draw", amount: 2 } },
    {
      kind: "passive",
      modifier: { kind: "while", condition: {
            kind: "and",
            conditions: [{ kind: "xp-at-least", amount: 6 }, not({ kind: "xp-at-least", amount: 11 })],
          }, modifier: { kind: "cost", amount: -2, target: SELF } },
    },
    {
      kind: "passive",
      modifier: { kind: "while", condition: { kind: "xp-at-least", amount: 11 }, modifier: { kind: "cost", amount: -4, target: SELF } },
    },
  ],
});
