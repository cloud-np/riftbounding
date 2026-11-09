/** The Papertree. */
import { registerCardScript, WHEN_YOU_HOLD_HERE } from "../sdk";

registerCardScript({
  name: "The Papertree",
  text: "When you hold here, each player channels 1 rune exhausted.",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: WHEN_YOU_HOLD_HERE,
      effect: { op: "channel", amount: 1, player: "each", exhausted: true },
    },
  ],
});
