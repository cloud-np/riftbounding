/** Startipped Peak (OGN-288, battlefield) — "When you hold here, you may channel 1 rune exhausted." (383.4.d.2.b, 403.1, 431.2.a) */
import { registerCardScript, WHEN_YOU_HOLD_HERE } from "../sdk";

registerCardScript({
  name: "Startipped Peak",
  text: "When you hold here, you may channel 1 rune exhausted.",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: WHEN_YOU_HOLD_HERE,
      optional: true,
      effect: { op: "channel", amount: 1, exhausted: true },
    },
  ],
});
