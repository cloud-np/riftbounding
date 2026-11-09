/** Consult the Heavens (RAD-025) — "Give a unit [Shield 2] this turn. [Predict]." (814, 437) */
import { aUnit, registerCardScript } from "../sdk";

registerCardScript({
  name: "Consult the Heavens",
  text: "[Reaction] (Play any time, even before spells and abilities resolve.)\nGive a unit [Shield 2] this turn. (+2 [Might] while it's a defender.)\n[Predict]. (Look at the top card of your Main Deck. You may recycle it.)",
  status: "implemented",
  abilities: [
    {
      kind: "spell",
      effect: {
        op: "seq",
        effects: [
          {
            op: "grant_keyword",
            keyword: "Shield",
            value: 2,
            target: aUnit(),
            duration: "this-turn",
          },
          { op: "predict", amount: 1 },
        ],
      },
    },
  ],
});
