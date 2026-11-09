/**
 * Improvised Projectile (RAD-056) — "Choose a friendly gear. Deal damage equal to its Energy
 * cost to a unit at a battlefield."
 */
import { aUnit, registerCardScript } from "../sdk";
import { letX } from "./custom";

registerCardScript({
  name: "Improvised Projectile",
  text: "[Action] (Play on your turn or in showdowns.)\nChoose a friendly gear. Deal damage equal to its Energy cost to a unit at a battlefield.",
  status: "implemented",
  abilities: [
    {
      kind: "spell",
      effect: {
        op: "for_each",
        selector: { chosen: true, cardType: "gear", controller: "self", targetRef: "target:0" },
        effect: {
          op: "for_each",
          selector: aUnit({ zone: "battlefield", targetRef: "target:1" }),
          effect: letX(
            { energyCostOf: { targetRef: "target:0" } },
            { op: "deal", amount: { kind: "x" }, target: { targetRef: "it" } },
          ),
        },
      },
    },
  ],
});
