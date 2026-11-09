/** LeBlanc, Deceiver. */
import { registerCardScript, SELF, token } from "../sdk";
import { REFLECTION_READY } from "./custom";

registerCardScript({
  name: "LeBlanc, Deceiver",
  text: "When you conquer or hold, you may discard 1 and exhaust me to play a ready Reflection unit token there. Then do this: It becomes a copy of another unit there. Give it [Temporary].",
  status: "partial",
  notes:
    "The optional discard/exhaust cost and the ready Reflection token are automated (383.3.b, 440). 'It becomes a copy of another unit there' is missing: copy effects (446) are not implemented.",
  abilities: [
    // The catalog's [Temporary] is the granted token keyword (reminder), not this legend's.
    { kind: "suppress-printed-keyword", keyword: "Temporary" },
    {
      kind: "triggered",
      trigger: { kind: "event", event: { type: ["conquer", "hold"], player: "self" } },
      effect: {
        op: "cost_then",
        optional: true,
        cost: { discard: 1, exhaust: SELF },
        effect: {
          op: "create",
          token: token("Reflection", REFLECTION_READY),
          zone: { kind: "chosen", ref: "event-zone" },
        },
      },
    },
  ],
});
