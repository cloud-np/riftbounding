/** Ruined Monastery (RAD-166) — "When you conquer here, you may discard 1 and channel 1 rune exhausted." */
import { registerCardScript, WHEN_YOU_CONQUER_HERE } from "../sdk";

registerCardScript({
  name: "Ruined Monastery",
  text: "When you conquer here, you may discard 1 and channel 1 rune exhausted.",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: WHEN_YOU_CONQUER_HERE,
      effect: {
        op: "may",
        effect: {
          op: "seq",
          effects: [
            { op: "discard", amount: 1 },
            { op: "channel", amount: 1, exhausted: true },
          ],
        },
      },
    },
  ],
});
