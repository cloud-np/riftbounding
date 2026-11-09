/** Hush (RAD-041) — "Counter a spell with Power cost [Rune] [Rune] or more." (426) */
import { registerCardScript } from "../sdk";

registerCardScript({
  name: "Hush",
  text: "[Reaction] (Play any time, even before spells and abilities resolve.)\nCounter a spell with Power cost [Rune] [Rune] or more.",
  status: "implemented",
  abilities: [
    {
      kind: "spell",
      effect: {
        op: "counter",
        target: { chosen: true, cardType: "spell", powerCost: { op: "gte", value: 2 } },
      },
    },
  ],
});
