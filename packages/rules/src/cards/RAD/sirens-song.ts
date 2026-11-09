/** Siren's Song (RAD-098) — "Move an enemy unit that moved this turn." (421) */
import { aUnit, custom, registerCardScript } from "../sdk";
import { zoneRef } from "./custom";

registerCardScript({
  name: "Siren's Song",
  text: "[Reaction] (Play any time, even before spells and abilities resolve.)\nMove an enemy unit that moved this turn.",
  status: "implemented",
  abilities: [
    {
      kind: "spell",
      effect: {
        op: "move",
        target: aUnit({ controller: "opponent", where: custom("rad:moved-this-turn") }),
        to: zoneRef("destination"),
      },
    },
  ],
});
