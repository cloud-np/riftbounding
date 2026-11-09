/**
 * Carnivorous Snapvine (OGN-149) — "When you play me, choose an enemy unit at a battlefield. We
 * deal damage equal to our Mights to each other." (418.6.b: each unit is the source of its damage)
 */
import { registerCardScript } from "../registry";
import { SELF, WHEN_PLAYED, aUnit } from "../dsl";

registerCardScript({
  name: "Carnivorous Snapvine",
  text: "When you play me, choose an enemy unit at a battlefield. We deal damage equal to our Mights to each other.",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: WHEN_PLAYED,
      effect: {
        op: "seq",
        effects: [
          {
            op: "deal",
            amount: { kind: "might", selector: SELF },
            target: aUnit({ controller: "opponent", zone: "battlefield", targetRef: "target:0" }),
            source: SELF,
          },
          {
            op: "deal",
            amount: { kind: "might", selector: { targetRef: "target:0" } },
            target: SELF,
            source: { targetRef: "target:0" },
          },
        ],
      },
    },
  ],
});
