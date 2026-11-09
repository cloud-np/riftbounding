/** K'Sante, Courageous (RAD-086) — "[Accelerate] [Shield 2] When I hold, channel 1 rune." (383.4.d.2.a, 431) */
import { registerCardScript, SELF } from "../sdk";

registerCardScript({
  name: "K'Sante, Courageous",
  text: "[Accelerate] (You may pay [1] [Body] as an additional cost to have me enter ready.)\n[Shield 2] (+2 [Might] while I'm a defender.)\nWhen I hold, channel 1 rune.",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: { kind: "event", event: { type: "hold", subject: SELF } },
      effect: { op: "channel", amount: 1 },
    },
  ],
});
