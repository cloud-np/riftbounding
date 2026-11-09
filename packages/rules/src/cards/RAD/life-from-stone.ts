/** Life from Stone (RAD-029) — "As an additional cost …, exhaust a friendly unit. Draw 1 and channel 1 rune exhausted." */
import { registerCardScript } from "../sdk";

registerCardScript({
  name: "Life from Stone",
  text: "[Reaction] (Play any time, even before spells and abilities resolve.)\nAs an additional cost to play this, exhaust a friendly unit.\nDraw 1 and channel 1 rune exhausted.",
  status: "implemented",
  abilities: [
    {
      kind: "spell",
      effect: {
        op: "seq",
        effects: [
          { op: "draw", amount: 1 },
          { op: "channel", amount: 1, exhausted: true },
        ],
      },
    },
  ],
});
