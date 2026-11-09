/**
 * Blastcone Fae (OGN-097) — [Hidden] (811, R2-play); "When you play me, give a unit -2 [Might] this
 * turn, to a minimum of 1 [Might]." (479.4.b snapshot)
 */
import { registerCardScript } from "../registry";
import { WHEN_PLAYED, aUnit } from "../dsl";

registerCardScript({
  name: "Blastcone Fae",
  text: "[HIDDEN] (Hide now for [Rune] to react with later for [0].)\nWhen you play me, give a unit -2 [Might] this turn, to a minimum of 1 [Might].",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: WHEN_PLAYED,
      effect: { op: "give_might", amount: -2, min: 1, target: aUnit() },
    },
  ],
});
