/** Gustwalker (UNL-075 — EX[281] (727.1.b.2): [Hunt 2] (823) and [Level 3] (824).) */
import { registerCardScript } from "../registry";
import { SELF, custom } from "../dsl";

const LEVEL_3 = custom("xp-at-least", { n: 3 });

registerCardScript({
  name: "Gustwalker",
  text: "[Hunt 2] (When i conquer or hold, gain 2 XP.)\n[Level 3] I have +1 [might] and [ganking] . (While you have 3+ XP, get the effect. A [ganking] unit can move from battlefield to battlefield.)",
  status: "implemented",
  abilities: [
    // [Ganking] is part of the [Level 3] dependent ability (727.1.b), not intrinsic.
    { kind: "keyword", keyword: "Ganking", value: 0 },
    {
      kind: "passive",
      modifier: { kind: "custom", id: "conditional", params: { condition: LEVEL_3, modifier: { kind: "might", amount: 1, target: SELF } } },
    },
    {
      kind: "passive",
      modifier: { kind: "custom", id: "conditional", params: { condition: LEVEL_3, modifier: { kind: "keyword", keyword: "Ganking", target: SELF } } },
    },
  ],
});
