/** Feral Strength (SFD-034 — EX[72] (355.14.h.1). [Repeat 2] is R2-play's.) */
import { registerCardScript } from "../registry";
import { aUnit } from "../dsl";

registerCardScript({
  name: "Feral Strength",
  text: "[Reaction] (Play any time, even before spells and abilities resolve.)\n[Repeat 2] (You may pay the additional cost to repeat this spell's effect.)\nGive a unit +2 [Might] this turn.",
  status: "partial",
  notes: "Repeat [2] is R2-play's optional additional cost.",
  abilities: [{ kind: "spell", effect: { op: "temporary_might", amount: 2, target: aUnit() } }],
});
