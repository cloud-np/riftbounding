/** Clanging Sentry (RAD-055 — EX[314] (831.2)) */
import { registerCardScript } from "../sdk";

registerCardScript({
  name: "Clanging Sentry",
  text: "Your Mechs have [Disarm]. (When each of us attacks, give an enemy unit there -1 [Might] this turn.)",
  status: "implemented",
  abilities: [
    // The catalog lists [Disarm] (reminder text); it is not intrinsic (831.2: values are summed).
    { kind: "suppress-printed-keyword", keyword: "Disarm" },
    {
      kind: "passive",
      modifier: {
        kind: "keyword",
        keyword: "Disarm",
        target: { cardType: "unit", controller: "self", tag: "Mech" },
      },
    },
  ],
});
