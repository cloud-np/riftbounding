/**
 * Combat Experience (UNL-031) — [Reaction] (813). Give a unit +1 [Might] this turn; [Level 6]
 * (824) +3 instead — the dependent ability is checked as the spell resolves (727.1.b).
 */
import { aUnit, custom, registerCardScript } from "../sdk";

const TARGET = aUnit({ targetRef: "target:0" });

registerCardScript({
  name: "Combat Experience",
  text: "[Reaction] (Play any time, even before spells and abilities resolve.)\nGive a unit +1[Might] this turn.\n[Level 6] Give it +3[Might] this turn instead. (While you have 6+ XP, get this effect.)",
  status: "implemented",
  abilities: [
    {
      kind: "spell",
      effect: {
        op: "if",
        condition: { kind: "xp-at-least", amount: 6 },
        then: { op: "temporary_might", amount: 3, target: TARGET },
        else: { op: "temporary_might", amount: 1, target: TARGET },
      },
    },
  ],
});
