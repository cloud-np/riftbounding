/** Resplendent Rostrum (RAD-046) — "[Tap]: Draw 1 and channel 1 rune exhausted. When this becomes exhausted, give a friendly unit +3 [Might] this turn." */
import { aUnit, registerCardScript, SELF, WHEN_I_BECOME_EXHAUSTED } from "../sdk";

registerCardScript({
  name: "Resplendent Rostrum",
  text: "[Tap]: Draw 1 and channel 1 rune exhausted.\nWhen this becomes exhausted, give a friendly unit +3 [Might] this turn.",
  status: "implemented",
  abilities: [
    {
      kind: "activated",
      cost: { exhaust: SELF },
      effect: {
        op: "seq",
        effects: [
          { op: "draw", amount: 1 },
          { op: "channel", amount: 1, exhausted: true },
        ],
      },
    },
    {
      kind: "triggered",
      trigger: WHEN_I_BECOME_EXHAUSTED,
      effect: { op: "temporary_might", amount: 3, target: aUnit({ controller: "self" }) },
    },
  ],
});
