/**
 * Wuju Apprentice (UNL-040) — [Hunt] (823, engine keyword). [Level 6] is a Dependent Keyword
 * (824, 727.1.c.1): the play effect only triggers while you have 6+ XP.
 */
import { registerCardScript } from "../registry";
import { WHEN_PLAYED, custom } from "../dsl";

registerCardScript({
  name: "Wuju Apprentice",
  text: "[Hunt] (When I conquer or hold, gain 1 XP.)\n[Level 6] When you play me, draw 1. (While you have 6+ XP, get the effect.)",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: WHEN_PLAYED,
      condition: custom("xp-at-least", { n: 6 }),
      effect: { op: "draw", amount: 1 },
    },
  ],
});
