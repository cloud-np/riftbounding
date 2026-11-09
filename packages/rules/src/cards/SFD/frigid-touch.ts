/** Frigid Touch (SFD-066 — EX[35] (142.4.b). [Repeat] (R2-play's optional additional cost) is not automated.) */
import { registerCardScript } from "../registry";
import { aUnit } from "../dsl";

registerCardScript({
  name: "Frigid Touch",
  text: "[Reaction] (Play any time, even before spells and abilities resolve.)\n[Repeat][2] (You may pay the additional cost to repeat this spell's effect.)\nGive a unit -2 [Might] this turn.",
  status: "partial",
  notes: "Repeat [2] is R2-play's optional additional cost.",
  abilities: [{ kind: "spell", effect: { op: "temporary_might", amount: -2, target: aUnit() } }],
});
