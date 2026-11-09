/** Lunar Boon. */
import { registerCardScript } from "../sdk";

registerCardScript({
  name: "Lunar Boon",
  text: "[Reaction] (Play any time, even before spells and abilities resolve.)\nDiscard 1, then draw 2.",
  status: "implemented",
  abilities: [
    {
      kind: "spell",
      effect: {
        op: "seq",
        effects: [
          { op: "discard", amount: 1 },
          { op: "draw", amount: 2 },
        ],
      },
    },
  ],
});
