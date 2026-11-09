/**
 * Crescent Strike (UNL-072) — [Action]. "Choose a battlefield and an enemy unit there. Deal 4 to
 * that unit and 1 to each other enemy unit there." The battlefield is the chosen unit's location
 * when the spell was finalized (359.3.e snapshot), so "there" survives the unit leaving (359.3.f).
 */
import { aUnit, custom, registerCardScript } from "../sdk";

registerCardScript({
  name: "Crescent Strike",
  text: "[Action] (Play on your turn or in showdowns.)\nChoose a battlefield and an enemy unit there. Deal 4 to that unit and 1 to each other enemy unit there.",
  status: "implemented",
  abilities: [
    {
      kind: "spell",
      effect: {
        op: "seq",
        effects: [
          {
            op: "deal",
            amount: 4,
            target: aUnit({ controller: "opponent", zone: "battlefield", targetRef: "target:0" }),
          },
          {
            op: "deal",
            amount: 1,
            target: {
              cardType: "unit",
              controller: "opponent",
              all: true,
              excludeRefs: ["target:0"],
              where: custom("unl:at-chosen-location", { ref: "target:0" }),
            },
          },
        ],
      },
    },
  ],
});
