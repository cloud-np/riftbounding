/** Kha'Zix, Mutating Horror. */
import { custom, registerCardScript, SELF, WHEN_I_ATTACK_OR_DEFEND } from "../sdk";

registerCardScript({
  name: "Kha'Zix, Mutating Horror",
  text: "[Ambush] (You may play me as a [Reaction] to a battlefield where you have units.)\nWhen I attack or defend, if an enemy unit is alone here, give me +2 [Might] this turn and gain 2 XP.",
  status: "implemented",
  abilities: [
    { kind: "suppress-printed-keyword", keyword: "Reaction" },
    {
      kind: "triggered",
      trigger: WHEN_I_ATTACK_OR_DEFEND,
      condition: custom("unl:enemy-alone-here"),
      effect: {
        op: "seq",
        effects: [
          { op: "temporary_might", amount: 2, target: SELF },
          { op: "gain_xp", amount: 2 },
        ],
      },
    },
  ],
});
