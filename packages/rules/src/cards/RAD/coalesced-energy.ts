/** Coalesced Energy (RAD-016) — "At the end of your turn, recycle all your runes, then channel 4 runes exhausted." (417, 431) */
import { registerCardScript } from "../sdk";

registerCardScript({
  name: "Coalesced Energy",
  text: "At the end of your turn, recycle all your runes, then channel 4 runes exhausted.",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: { kind: "turn-end" },
      effect: {
        op: "seq",
        effects: [
          { op: "recycle", target: { cardType: "rune", controller: "self" } },
          { op: "channel", amount: 4, exhausted: true },
        ],
      },
    },
  ],
});
