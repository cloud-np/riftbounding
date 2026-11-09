/** Grim Apothecary. */
import { aUnit, registerCardScript, WHEN_PLAYED } from "../sdk";

registerCardScript({
  name: "Grim Apothecary",
  text: "[Ambush] (You may play me as a [Reaction] to a battlefield where you have units.)\nWhen you play me, you may return a friendly unit at a battlefield to its owner's hand.",
  status: "implemented",
  abilities: [
    { kind: "suppress-printed-keyword", keyword: "Reaction" },
    {
      kind: "triggered",
      trigger: WHEN_PLAYED,
      optional: true,
      effect: { op: "return_to_hand", target: aUnit({ controller: "self", zone: "battlefield" }) },
    },
  ],
});
