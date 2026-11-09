/**
 * Pack of Wonders (OGN-181, Origins errata) — "[Tap]: Return another friendly gear, unit, or
 * facedown card to its owner's hand."
 *
 * Registers `ogn:permanent-or-facedown`: the candidate (`it`) is a unit or gear, or a facedown
 * card (107.3 / 811). Return to hand goes to the owner's hand (056).
 */
import { custom, registerCardScript, SELF } from "../sdk";

registerCardScript({
  name: "Pack of Wonders",
  text: "[Tap]: Return another friendly gear, unit, or facedown card to its owner's hand.",
  status: "implemented",
  abilities: [
    {
      kind: "activated",
      cost: { exhaust: SELF },
      effect: {
        op: "return_to_hand",
        target: {
          chosen: true,
          cardType: "card",
          controller: "self",
          excludeSource: true,
          where: custom("ogn:permanent-or-facedown"),
        },
      },
    },
  ],
});
