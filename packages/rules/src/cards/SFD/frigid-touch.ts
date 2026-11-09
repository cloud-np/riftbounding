/** Frigid Touch (SFD-066 — EX[35] (142.4.b). [Repeat] is engine-supported (820.1.d / 820.2). */
import { aUnit, registerCardScript } from "../sdk";

registerCardScript({
  name: "Frigid Touch",
  text: "[Reaction] (Play any time, even before spells and abilities resolve.)\n[Repeat][2] (You may pay the additional cost to repeat this spell's effect.)\nGive a unit -2 [Might] this turn.",
  status: "implemented",
  abilities: [{ kind: "spell", effect: { op: "temporary_might", amount: -2, target: aUnit() } }],
});
