/**
 * Storm Raptor (RAD-035) — "[Deflect] When a stunned enemy unit here dies, draw 1."
 *
 * 424 / 383.2.c.3.b: the die event carries the dead unit's last-known stunned status and zone, so
 * the subject matcher can read "stunned enemy unit here". [Deflect] is the engine's.
 */
import { registerCardScript } from "../sdk";

registerCardScript({
  name: "Storm Raptor",
  text: "[Deflect] (Opponents must pay [Rune] to choose me with a spell or ability.)\nWhen a stunned enemy unit here dies, draw 1.",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: {
        kind: "event",
        event: {
          type: "die",
          subject: {
            cardType: "unit",
            controller: "opponent",
            zone: { kind: "chosen", ref: "here" },
            stunned: true,
          },
        },
      },
      effect: { op: "draw", amount: 1 },
    },
  ],
});
