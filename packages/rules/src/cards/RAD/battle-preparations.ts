/** Battle Preparations (RAD-032) — "[Show Off] a gear. Give a unit +2 [Might] this turn. If you showed off, ready up to 2 runes." (832) */
import { aUnit, registerCardScript, SHOWED_OFF, showOff } from "../sdk";

registerCardScript({
  name: "Battle Preparations",
  text: "[Reaction] (Play any time, even before spells and abilities resolve.)\n[Show Off] a gear. (As you play this, you may reveal a gear from your hand or pick a friendly gear.)\nGive a unit +2 [Might] this turn. If you showed off, ready up to 2 runes.",
  status: "implemented",
  abilities: [
    showOff({ cardType: "gear" }),
    {
      kind: "spell",
      effect: {
        op: "seq",
        effects: [
          { op: "temporary_might", amount: 2, target: aUnit() },
          {
            op: "if",
            condition: SHOWED_OFF,
            then: { op: "ready", target: { cardType: "rune", controller: "self", maxCount: 2 } },
          },
        ],
      },
    },
  ],
});
