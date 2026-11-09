/** Fiora, Grand Duelist. */
import { registerCardScript, SELF } from "../sdk";

registerCardScript({
  name: "Fiora, Grand Duelist",
  text: "When one of your units becomes [Mighty], you may exhaust me to channel 1 rune exhausted. (A unit is Mighty while it has 5+ [Might].)",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: { kind: "event", event: { type: "become_mighty", player: "self" } },
      effect: {
        op: "cost_then",
        optional: true,
        cost: { exhaust: SELF },
        effect: { op: "channel", amount: 1, exhausted: true },
      },
    },
  ],
});
