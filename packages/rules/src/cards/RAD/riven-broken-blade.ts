/**
 * Riven, Broken Blade (RAD-043) — "When I become exhausted, choose one that hasn't been chosen
 * this turn – • [Buff] me. • Spend my buff to [Stun] an enemy unit. • Spend my buff to ready me."
 *
 * Modes already chosen this turn are recorded with `mark` (per-turn history) and become
 * unavailable through `requires` guards (355.3). "Spend my buff to …" is a cost within an
 * instruction (740.4.a / 355.10.c.1): without a buff to spend (702.2.b.1) nothing happens.
 */
import type { Effect } from "@rift/protocol";
import { aUnit, marked, not, registerCardScript, SELF, WHEN_I_BECOME_EXHAUSTED } from "../sdk";

const KEY = "riven-broken-blade:{self}";

function mode(id: string, label: string, effect: Effect) {
  return {
    id,
    label,
    effect: {
      op: "requires" as const,
      condition: not(marked(KEY, id)),
      effect: {
        op: "seq" as const,
        effects: [{ op: "mark" as const, key: KEY, value: id }, effect],
      },
    },
  };
}

registerCardScript({
  name: "Riven, Broken Blade",
  text: "When I become exhausted, choose one that hasn't been chosen this turn –\n• [Buff] me. (Give me a +1 [Might] buff if I don't have one.)\n• Spend my buff to [Stun] an enemy unit. (It doesn't deal combat damage this turn.)\n• Spend my buff to ready me.",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: WHEN_I_BECOME_EXHAUSTED,
      effect: {
        op: "choose_mode",
        modes: [
          mode("buff", "Buff me", { op: "buff", target: SELF }),
          mode("stun", "Spend my buff to stun an enemy unit", {
            op: "seq",
            effects: [
              { op: "spend_buff", target: SELF },
              {
                op: "if",
                condition: { kind: "did" },
                then: { op: "stun", target: aUnit({ controller: "opponent" }) },
              },
            ],
          }),
          mode("ready", "Spend my buff to ready me", {
            op: "seq",
            effects: [
              { op: "spend_buff", target: SELF },
              { op: "if", condition: { kind: "did" }, then: { op: "ready", target: SELF } },
            ],
          }),
        ],
      },
    },
  ],
});
