/** Kha'Zix, Evolving Hunter. */
import { registerCardScript, SELF, WHEN_I_ATTACK } from "../sdk";
import { ENEMY_HERE } from "./custom";

registerCardScript({
  name: "Kha'Zix, Evolving Hunter",
  text: "[Hunt] (When I conquer or hold, gain 1 XP.)\nWhen I attack, you may spend 3 XP to deal damage equal to my Might to an enemy unit here.",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: WHEN_I_ATTACK,
      effect: {
        op: "cost_then",
        optional: true,
        cost: { spendXp: 3 },
        effect: {
          op: "deal",
          amount: { kind: "might", selector: SELF },
          target: ENEMY_HERE,
          source: SELF,
        },
      },
    },
  ],
});
