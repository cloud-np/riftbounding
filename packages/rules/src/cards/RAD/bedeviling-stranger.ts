/**
 * Bedeviling Stranger (RAD-107) — "[Hidden] When you play me, choose a battlefield. If there are 4
 * or more units there, you may return an enemy unit there to its owner's hand."
 */
import { aUnit, custom, registerCardScript, WHEN_PLAYED } from "../sdk";
import { aBattlefield, zoneRef } from "./custom";

registerCardScript({
  name: "Bedeviling Stranger",
  text: "[Hidden] (Hide now for [Rune] to react with later for [0].)\nWhen you play me, choose a battlefield. If there are 4 or more units there, you may return an enemy unit there to its owner's hand.",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: WHEN_PLAYED,
      effect: {
        op: "for_each",
        selector: aBattlefield("battlefield"),
        effect: {
          op: "if",
          condition: {
            kind: "count",
            selector: {
              cardType: "unit",
              zone: zoneRef("battlefield"),
              where: custom("rad:face-up"),
            },
            comparison: { op: "gte", value: 4 },
          },
          then: {
            op: "may",
            effect: {
              op: "return_to_hand",
              target: aUnit({ controller: "opponent", zone: zoneRef("battlefield") }),
            },
          },
        },
      },
    },
  ],
});
