/** Stormclaw Ursine (OGN-137) — "[TANK] When you play me, channel 1 rune exhausted." (815 Tank keyword; 431.2.a) */
import { registerCardScript, WHEN_PLAYED } from "../sdk";

registerCardScript({
  name: "Stormclaw Ursine",
  text: "[TANK] (I must be assigned combat damage first.)\nWhen you play me, channel 1 rune exhausted.",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: WHEN_PLAYED,
      effect: { op: "channel", amount: 1, exhausted: true },
    },
  ],
});
