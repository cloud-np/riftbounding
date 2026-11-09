/** Discipline (OGN-058 — EX[260]/EX[262] (481)) */
import { registerCardScript } from "../registry";
import { aUnit } from "../dsl";

registerCardScript({
  name: "Discipline",
  text: "[REACTION] (Play any time, even before spells and abilities resolve.)\n\nGive a unit +2 [Might] this turn. Draw 1.",
  status: "implemented",
  abilities: [
    {
      kind: "spell",
      effect: { op: "seq", effects: [{ op: "temporary_might", amount: 2, target: aUnit() }, { op: "draw", amount: 1 }] },
    },
  ],
});
