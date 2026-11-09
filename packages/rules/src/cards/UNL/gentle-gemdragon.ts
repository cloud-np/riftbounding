/**
 * Gentle Gemdragon (UNL-104) — "When you play me or another Dragon, ready up to 2 runes."
 * (Dragon is a tag, 143.1; Gemdragon is itself a Dragon; up to 2 = 355.13.)
 */
import { registerCardScript } from "../sdk";

registerCardScript({
  name: "Gentle Gemdragon",
  text: "When you play me or another Dragon, ready up to 2 runes.",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: {
        kind: "event",
        event: { type: "unit_played", player: "self", subject: { tag: "Dragon" } },
      },
      effect: {
        op: "ready",
        target: { chosen: true, cardType: "rune", controller: "self", maxCount: 2 },
      },
    },
  ],
});
