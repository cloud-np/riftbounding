/**
 * Sigil of the Storm (OGN-287, battlefield, Origins errata) — "When you conquer here, you must
 * recycle one of your runes. (This doesn't choose anything.)"
 *
 * The player picks which of their runes to recycle without targeting (355.18, as the reminder
 * says); it goes to the bottom of its owner's Rune Deck (417.1.b). With no runes nothing happens.
 */
import { registerCardScript, WHEN_YOU_CONQUER_HERE } from "../sdk";

registerCardScript({
  name: "Sigil of the Storm",
  text: "When you conquer here, you must recycle one of your runes. (This doesn't choose anything.)",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: WHEN_YOU_CONQUER_HERE,
      effect: {
        op: "seq",
        effects: [
          {
            op: "choose",
            key: "rune",
            selector: { cardType: "rune", zone: "runeArea", controller: "self" },
            min: 1,
            max: 1,
          },
          { op: "recycle", target: { targetRef: "rune" } },
        ],
      },
    },
  ],
});
