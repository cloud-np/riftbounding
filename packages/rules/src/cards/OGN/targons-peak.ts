/**
 * Targon's Peak (OGN-289, battlefield, Origins errata) — "When you conquer here, ready up to 2
 * runes at the end of this turn."
 *
 * The conquer trigger (383.4.c.2.b) creates a delayed triggered ability (390–393) for the end of
 * this turn; its "up to 2 runes" are chosen when that delayed ability triggers (355.5.b).
 */
import { registerCardScript, WHEN_YOU_CONQUER_HERE } from "../sdk";

registerCardScript({
  name: "Targon's Peak",
  text: "When you conquer here, ready up to 2 runes at the end of this turn.",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: WHEN_YOU_CONQUER_HERE,
      effect: {
        op: "delayed",
        trigger: { kind: "turn-end" },
        once: true,
        effect: { op: "ready", target: { chosen: true, cardType: "rune", maxCount: 2 } },
      },
    },
  ],
});
