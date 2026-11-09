/**
 * Firestorm (OGS-002) — "Deal 3 to all enemy units at a battlefield."
 *
 * The battlefield is the chosen object (355.7, a battlefield pseudo-object); every enemy unit
 * there is dealt 3 (355.5.a, not targeted).
 */
import { registerCardScript } from "../sdk";

registerCardScript({
  name: "Firestorm",
  text: "Deal 3 to all enemy units at a battlefield.",
  status: "implemented",
  abilities: [
    {
      kind: "spell",
      effect: {
        op: "for_each",
        selector: { chosen: true, cardType: "battlefield", targetRef: "target:0" },
        effect: {
          op: "deal",
          amount: 3,
          target: {
            cardType: "unit",
            controller: "opponent",
            zone: { kind: "chosen", ref: "target:0" },
          },
        },
      },
    },
  ],
});
