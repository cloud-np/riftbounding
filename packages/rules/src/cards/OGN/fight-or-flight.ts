/** Fight or Flight (OGN-168) — "[Hidden] [Action] Move a unit from a battlefield to its base." (421; Hidden 811 is R2-play's) */
import { aUnit, registerCardScript } from "../sdk";

registerCardScript({
  name: "Fight or Flight",
  text: "[Hidden] (Hide now for [Rune] to react with later for [0].)\n[Action] (Play on your turn or in showdowns.)\nMove a unit from a battlefield to its base.",
  status: "implemented",
  abilities: [
    { kind: "spell", effect: { op: "move", target: aUnit({ zone: "battlefield" }), to: "base" } },
  ],
});
