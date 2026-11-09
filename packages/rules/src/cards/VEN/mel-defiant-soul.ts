/** Mel, Defiant Soul. */
import { aUnit, registerCardScript, SELF, SELF_EMPOWERED } from "../sdk";

registerCardScript({
  name: "Mel, Defiant Soul",
  text: "[Empower] - Discard a spell (Pay the cost: Empower me. Use only if not Empowered.)\nWhen I become [Empowered], banish an enemy unit at a battlefield with 3 [Might] or less.",
  status: "partial",
  notes:
    "The Empower cost is 'Discard a spell', but `Cost.discard` has no card-type filter (423.1.a), so any card can be discarded.",
  abilities: [
    {
      kind: "activated",
      cost: { discard: 1 },
      effect: {
        op: "requires",
        condition: { kind: "not", condition: SELF_EMPOWERED },
        rule: "827.1.c.1",
        effect: { op: "empower", target: SELF },
      },
    },
    {
      kind: "triggered",
      trigger: { kind: "event", event: { type: "empower", subject: SELF } },
      effect: {
        op: "banish",
        target: aUnit({
          controller: "opponent",
          zone: "battlefield",
          might: { op: "lte", value: 3 },
        }),
      },
    },
  ],
});
