/** Temporal Breach. */
import { aUnit, registerCardScript } from "../sdk";

const TEMPORAL_BREACH_UNIT = aUnit({ targetRef: "target:0" });

registerCardScript({
  name: "Temporal Breach",
  text: "[Hidden] (Hide now for [Rune] to react with later for [0].)\nBanish a unit, then its owner plays it to the same location, ignoring its cost.",
  status: "implemented",
  abilities: [
    {
      kind: "spell",
      effect: {
        op: "seq",
        effects: [
          { op: "deal", amount: 0, target: TEMPORAL_BREACH_UNIT },
          { op: "custom", id: "ven:banish-then-replay", params: { ref: "target:0" } },
        ],
      },
    },
  ],
});
