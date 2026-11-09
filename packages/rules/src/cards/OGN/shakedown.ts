/**
 * Shakedown (OGN-033) — "[REACTION] Choose an enemy unit. Deal 6 to it unless its controller has you
 * draw 2."
 *
 * The enemy unit is the target (355.7). Registers `ogn:unless-you-draw`: on resolution the
 * unit's controller decides (a decision made during resolution by another player, 355.18) whether
 * the spell's controller draws `draw`; otherwise `it` is dealt `amount` damage by the spell (418.6.a).
 */
import { aUnit, registerCardScript } from "../sdk";

registerCardScript({
  name: "Shakedown",
  text: "[REACTION] (Play any time, even before spells and abilities resolve.)\nChoose an enemy unit. Deal 6 to it unless its controller has you draw 2.",
  status: "implemented",
  abilities: [
    {
      kind: "spell",
      effect: {
        op: "for_each",
        selector: aUnit({ controller: "opponent" }),
        effect: { op: "custom", id: "ogn:unless-you-draw", params: { amount: 6, draw: 2 } },
      },
    },
  ],
});
