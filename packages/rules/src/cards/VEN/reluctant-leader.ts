/** Reluctant Leader. */
import { registerCardScript, SELF } from "../sdk";

registerCardScript({
  name: "Reluctant Leader",
  text: "When you play another unit, give me +2 [Might] this turn.",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      // 420.4.a / 440.2.c: when another unit you play (tokens included) has been played.
      trigger: {
        kind: "event",
        event: {
          type: "unit_played",
          player: "self",
          subject: { cardType: "unit", excludeSource: true },
        },
      },
      effect: { op: "temporary_might", amount: 2, target: SELF },
    },
  ],
});
