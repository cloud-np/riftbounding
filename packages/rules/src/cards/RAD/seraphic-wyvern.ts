/**
 * Seraphic Wyvern (RAD-092) — "If you would channel runes, channel that many runes plus 1
 * exhausted rune instead." (367–375 replacement of the Channel action, 431.)
 */
import { registerCardScript } from "../sdk";

registerCardScript({
  name: "Seraphic Wyvern",
  text: "If you would channel runes, channel that many runes plus 1 exhausted rune instead.",
  status: "partial",
  notes:
    "The replacement channels the proposed count plus one exhausted rune, but the Channel proposal does not carry the original 'exhausted' condition: a channel that itself said 'exhausted' would channel its base runes ready (431.2).",
  abilities: [
    {
      kind: "replacement",
      matches: { type: "channel", player: "self" },
      replace: { op: "custom", id: "rad:channel-plus-one" },
    },
  ],
});
