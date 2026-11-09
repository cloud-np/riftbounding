/** High Note (RAD-048) — "Give a unit -[Might] this turn equal to the number of exhausted units you control." */
import { aUnit, registerCardScript } from "../sdk";

registerCardScript({
  name: "High Note",
  text: "[Reaction] (Play any time, even before spells and abilities resolve.)\nGive a unit -[Might] this turn equal to the number of exhausted units you control.",
  status: "implemented",
  abilities: [
    {
      kind: "spell",
      effect: {
        op: "temporary_might",
        amount: {
          kind: "count",
          selector: { cardType: "unit", controller: "self", exhausted: true },
          per: -1,
        },
        target: aUnit(),
      },
    },
  ],
});
