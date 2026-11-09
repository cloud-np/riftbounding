/** Decree of Insight (VEN-061) — "[Reaction] Ignore [Deflect] while paying this spell's cost. Give an enemy Body unit -5 [Might] this turn." */
import { registerCardScript } from "../registry";
import { aUnit, custom } from "../dsl";

registerCardScript({
  name: "Decree of Insight",
  text: "[Reaction] (Play any time, even before spells and abilities resolve.)\nIgnore [Deflect] while paying this spell's cost.\nGive an enemy Body ([Body]) unit -5 [Might] this turn.",
  status: "partial",
  notes:
    "'Ignore [Deflect] while paying this spell's cost' is not automated: R2-play's Deflect cost does not read ignore-keyword modifiers (766/767, EX[292]).",
  abilities: [
    {
      kind: "spell",
      effect: {
        op: "temporary_might",
        amount: -5,
        target: aUnit({
          controller: "opponent",
          where: custom("ven:has-domain", { domain: "Body" }),
        }),
      },
    },
  ],
});
